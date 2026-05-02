import { CampaignStatus, EnrichmentStatus, JobStatus, JobType, Prisma, WebsiteStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/src/server/db/prisma";
import { logger } from "@/src/server/utils/logger";
import { errorMessage, truncateError } from "@/src/server/utils/errors";
import { geocodeLocation } from "./geocoding.service";
import { queryOverpassBusinesses } from "./overpass.service";
import { normalizeOverpassElements, type NormalizedLead } from "./lead-normalizer.service";
import { crawlLeadWebsite } from "./crawler.service";
import { calculateLeadScore, normalizeIssueKeys } from "./lead-scoring.service";
import { generateOpportunitySummary } from "./opportunity.service";
import { generateOutreachDraft } from "./outreach-template.service";
import { ensureJob, refreshCampaignStats } from "./campaign.service";
import { validateEmail } from "./email-validation.service";
import { getEditableSettings } from "./settings.service";

const STALE_PROCESSING_MS = 10 * 60 * 1000;
const MAX_BATCH_LIMIT = 10;

export async function processJobBatch(input: { limit?: number; types?: JobType[] }) {
  const limit = Math.min(MAX_BATCH_LIMIT, Math.max(1, input.limit ?? 5));
  await releaseStaleJobs();
  const workerId = `vercel-${nanoid(8)}`;

  let processed = 0;
  let failed = 0;

  while (processed + failed < limit) {
    const job = await prisma.job.findFirst({
      where: {
        status: JobStatus.PENDING,
        availableAt: { lte: new Date() },
        ...(input.types?.length ? { type: { in: input.types } } : {})
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }]
    });
    if (!job) break;
    const locked = await lockJob(job.id, workerId);
    if (!locked) continue;
    try {
      logger.info("job_started", { jobId: job.id, type: job.type });
      await runJob(locked);
      const completed = await prisma.job.updateMany({
        where: { id: job.id, lockedBy: workerId, status: JobStatus.PROCESSING },
        data: {
          status: JobStatus.COMPLETED,
          lockedAt: null,
          lockedBy: null,
          lastError: null
        }
      });
      if (!completed.count) {
        logger.warn("stale_completion_ignored", { jobId: job.id, type: job.type, workerId });
        continue;
      }
      logger.info("job_completed", { jobId: job.id, type: job.type });
      processed++;
    } catch (error) {
      failed++;
      await failOrRetryJob(job.id, workerId, error);
      logger.error("job_failed", { jobId: job.id, type: job.type, error: errorMessage(error) });
    }
  }

  const remaining = await prisma.job.count({
    where: {
      status: JobStatus.PENDING,
      availableAt: { lte: new Date() },
      ...(input.types?.length ? { type: { in: input.types } } : {})
    }
  });

  return { processed, failed, remaining };
}

async function releaseStaleJobs() {
  await prisma.job.updateMany({
    where: {
      status: JobStatus.PROCESSING,
      lockedAt: { lt: new Date(Date.now() - STALE_PROCESSING_MS) }
    },
    data: {
      status: JobStatus.PENDING,
      lockedAt: null,
      lockedBy: null
    }
  });
}

async function lockJob(jobId: string, workerId: string) {
  const result = await prisma.job.updateMany({
    where: { id: jobId, status: JobStatus.PENDING, availableAt: { lte: new Date() } },
    data: { status: JobStatus.PROCESSING, lockedAt: new Date(), lockedBy: workerId }
  });
  if (!result.count) return null;
  return prisma.job.findUniqueOrThrow({ where: { id: jobId } });
}

async function failOrRetryJob(jobId: string, workerId: string, error: unknown) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  if (job.lockedBy !== workerId || job.status !== JobStatus.PROCESSING) {
    logger.warn("stale_failure_ignored", { jobId, workerId });
    return;
  }
  const attempts = job.attempts + 1;
  const message = truncateError(error, 1000);
  if (attempts >= job.maxAttempts) {
    const updated = await prisma.job.updateMany({
      where: { id: jobId, lockedBy: workerId, status: JobStatus.PROCESSING },
      data: {
        status: JobStatus.FAILED,
        attempts,
        lastError: message,
        lockedAt: null,
        lockedBy: null
      }
    });
    if (updated.count) await markRelatedFailure(job, message);
    return;
  }

  const delaySeconds = attempts === 1 ? 60 : attempts === 2 ? 300 : 1800;
  await prisma.job.updateMany({
    where: { id: jobId, lockedBy: workerId, status: JobStatus.PROCESSING },
    data: {
      status: JobStatus.PENDING,
      attempts,
      lastError: message,
      lockedAt: null,
      lockedBy: null,
      availableAt: new Date(Date.now() + delaySeconds * 1000)
    }
  });
}

async function markRelatedFailure(job: { type: JobType; campaignId: string | null; leadId: string | null }, message: string) {
  if (job.leadId && job.type === JobType.ENRICH_LEAD_WEBSITE) {
    const lead = await prisma.lead.update({
      where: { id: job.leadId },
      data: {
        enrichmentStatus: EnrichmentStatus.FAILED,
        websiteStatus: WebsiteStatus.FAILED,
        lastError: message.slice(0, 1000)
      }
    });
    await ensureJob({
      type: JobType.SCORE_LEAD,
      campaignId: lead.campaignId,
      leadId: lead.id,
      payload: { failedEnrichment: true }
    });
  }
  if (job.campaignId && (job.type === JobType.GEOCODE_CAMPAIGN || job.type === JobType.COLLECT_OSM_LEADS)) {
    await prisma.campaign.update({
      where: { id: job.campaignId },
      data: {
        status: CampaignStatus.FAILED,
        lastError: message.slice(0, 1000)
      }
    });
  }
}

async function runJob(job: Awaited<ReturnType<typeof lockJob>>) {
  if (!job) return;
  switch (job.type) {
    case JobType.GEOCODE_CAMPAIGN:
      return processGeocodeCampaign(job.campaignId);
    case JobType.COLLECT_OSM_LEADS:
      return processCollectOsmLeads(job.campaignId);
    case JobType.ENRICH_LEAD_WEBSITE:
      return processEnrichLead(job.leadId);
    case JobType.SCORE_LEAD:
      return processScoreLead(job.leadId);
    case JobType.GENERATE_OUTREACH_DRAFT:
      return processGenerateDraft(job.leadId);
  }
}

async function processGeocodeCampaign(campaignId?: string | null) {
  if (!campaignId) throw new Error("Campaign job missing campaignId");
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const result = await geocodeLocation(campaign.locationQuery);
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      latitude: result.latitude,
      longitude: result.longitude,
      status: CampaignStatus.READY,
      collectionStatus: "geocoded",
      lastError: null
    }
  });
  await ensureJob({
    type: JobType.COLLECT_OSM_LEADS,
    campaignId,
    payload: {
      latitude: result.latitude,
      longitude: result.longitude,
      radiusMeters: campaign.radiusMeters,
      osmCategoryKey: campaign.osmCategoryKey,
      maxLeads: campaign.maxLeads
    }
  });
}

async function processCollectOsmLeads(campaignId?: string | null) {
  if (!campaignId) throw new Error("Collection job missing campaignId");
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (!campaign.latitude || !campaign.longitude) throw new Error("Campaign has not been geocoded");
  const existingCount = await prisma.lead.count({ where: { campaignId } });
  const remainingBudget = Math.max(0, campaign.maxLeads - existingCount);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.COLLECTING, collectionStatus: "collecting", lastError: null }
  });

  if (remainingBudget === 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { collectionStatus: "collected" } });
    await refreshCampaignStats(campaignId);
    logger.info("leads_collected", { campaignId, inserted: 0, sourceCount: 0, reason: "max_leads_reached" });
    return;
  }

  const elements = await queryOverpassBusinesses({
    latitude: campaign.latitude,
    longitude: campaign.longitude,
    radiusMeters: campaign.radiusMeters,
    osmCategoryKey: campaign.osmCategoryKey,
    maxLeads: remainingBudget
  });
  const leads = normalizeOverpassElements(elements, campaign.osmCategoryKey).slice(0, remainingBudget);
  let inserted = 0;

  for (const lead of leads) {
    const duplicateByDomain =
      lead.normalizedDomain &&
      (await prisma.lead.findFirst({
        where: {
          campaignId,
          normalizedDomain: lead.normalizedDomain
        },
        select: { id: true }
      }));
    if (duplicateByDomain) continue;

    const created = await upsertCollectedLead(campaignId, lead);

    inserted++;
    if (created.email) {
      const validation = await validateEmail(created.email);
      await prisma.lead.update({
        where: { id: created.id },
        data: { emailStatus: validation.status }
      });
      await prisma.extractedEmail.upsert({
        where: { leadId_email: { leadId: created.id, email: created.email.toLowerCase() } },
        update: {
          sourceUrl: "openstreetmap",
          domain: validation.domain ?? created.email.split("@")[1]?.toLowerCase() ?? "",
          localPart: created.email.split("@")[0]?.toLowerCase() ?? "",
          emailType: "osm",
          hasMx: validation.hasMx,
          status: validation.status
        },
        create: {
          leadId: created.id,
          email: created.email.toLowerCase(),
          sourceUrl: "openstreetmap",
          domain: validation.domain ?? created.email.split("@")[1]?.toLowerCase() ?? "",
          localPart: created.email.split("@")[0]?.toLowerCase() ?? "",
          emailType: "osm",
          hasMx: validation.hasMx,
          status: validation.status
        }
      });
    }

    await ensureJob({
      type: created.website ? JobType.ENRICH_LEAD_WEBSITE : JobType.SCORE_LEAD,
      campaignId,
      leadId: created.id,
      payload: { website: created.website }
    });
  }

  await refreshCampaignStats(campaignId);
  await prisma.campaign.update({ where: { id: campaignId }, data: { collectionStatus: "collected" } });
  await refreshCampaignStats(campaignId);
  logger.info("leads_collected", { campaignId, inserted, sourceCount: elements.length });
}

async function upsertCollectedLead(campaignId: string, lead: NormalizedLead) {
  const data = {
    companyName: lead.companyName,
    category: lead.category,
    address: lead.address,
    latitude: lead.latitude,
    longitude: lead.longitude,
    phone: lead.phone,
    website: lead.website,
    normalizedDomain: lead.normalizedDomain,
    email: lead.email,
    facebookUrl: lead.facebookUrl,
    instagramUrl: lead.instagramUrl,
    linkedinUrl: lead.linkedinUrl,
    socialUrl: lead.socialUrl,
    rawOsmTags: lead.rawOsmTags,
    tagsJson: lead.tagsJson
  };

  try {
    return await prisma.lead.upsert({
      where: {
        campaignId_sourceId: {
          campaignId,
          sourceId: lead.sourceId ?? ""
        }
      },
      update: data,
      create: {
        campaignId,
        sourceId: lead.sourceId,
        sourceType: lead.sourceType,
        ...data
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && lead.normalizedDomain) {
      const existing = await prisma.lead.findFirst({
        where: { campaignId, normalizedDomain: lead.normalizedDomain },
        orderBy: { createdAt: "asc" }
      });
      if (existing) {
        return prisma.lead.update({
          where: { id: existing.id },
          data: {
            ...data,
            sourceId: existing.sourceId ?? lead.sourceId,
            sourceType: existing.sourceType ?? lead.sourceType
          }
        });
      }
    }
    throw error;
  }
}

async function processEnrichLead(leadId?: string | null) {
  if (!leadId) throw new Error("Enrichment job missing leadId");
  await crawlLeadWebsite(leadId);
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  await ensureJob({
    type: JobType.SCORE_LEAD,
    campaignId: lead.campaignId,
    leadId,
    payload: {}
  });
  await refreshCampaignStats(lead.campaignId);
  logger.info("lead_enriched", { leadId });
}

async function processScoreLead(leadId?: string | null) {
  if (!leadId) throw new Error("Score job missing leadId");
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { campaign: true, audits: { orderBy: { createdAt: "desc" }, take: 1 } }
  });

  const issues = normalizeIssueKeys(lead.issuesJson);
  const fallbackIssues = !lead.website ? ["no_website"] : issues;
  const score = calculateLeadScore(lead, fallbackIssues, lead.campaign.serviceOffer);
  const opportunitySummary = generateOpportunitySummary(fallbackIssues, lead.campaign.serviceOffer);

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      leadScore: score,
      opportunitySummary,
      ...(!lead.website ? { websiteStatus: WebsiteStatus.NO_WEBSITE, enrichmentStatus: EnrichmentStatus.SKIPPED } : {}),
      ...(fallbackIssues.length && !issues.length
        ? { issuesJson: fallbackIssues.map((key) => ({ key, label: key.replace(/_/g, " "), severity: "medium" })) }
        : {})
    }
  });
  await ensureJob({
    type: JobType.GENERATE_OUTREACH_DRAFT,
    campaignId: lead.campaignId,
    leadId,
    payload: {}
  });
  await refreshCampaignStats(lead.campaignId);
}

async function processGenerateDraft(leadId?: string | null) {
  if (!leadId) throw new Error("Draft job missing leadId");
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { campaign: true } });
  const settings = await getEditableSettings();
  const draft = generateOutreachDraft(lead, lead.campaign, settings);
  const existing = await prisma.outreachDraft.findFirst({ where: { leadId }, select: { id: true } });
  if (existing) {
    await prisma.outreachDraft.update({
      where: { id: existing.id },
      data: {
        subject: draft.subject,
        body: draft.body,
        templateKey: draft.templateKey
      }
    });
  } else {
    await prisma.outreachDraft.create({
      data: {
        leadId,
        subject: draft.subject,
        body: draft.body,
        templateKey: draft.templateKey
      }
    });
  }
  await prisma.lead.update({
    where: { id: leadId },
    data: { outreachStatus: "DRAFT_CREATED" }
  });
}
