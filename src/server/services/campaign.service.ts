import { CampaignStatus, EnrichmentStatus, JobStatus, JobType, Prisma, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import type { CampaignCreateInput } from "@/src/shared/schemas/campaign.schema";
import { logger } from "@/src/server/utils/logger";

export async function createCampaign(input: CampaignCreateInput) {
  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      businessType: input.businessType,
      osmCategoryKey: input.osmCategoryKey,
      locationQuery: input.locationQuery,
      radiusMeters: input.radiusMeters,
      maxLeads: input.maxLeads,
      serviceOffer: input.serviceOffer || null,
      senderName: input.senderName || null,
      senderCompany: input.senderCompany || null,
      senderService: input.senderService || null,
      jobs: {
        create: {
          type: JobType.GEOCODE_CAMPAIGN,
          payload: { locationQuery: input.locationQuery }
        }
      }
    }
  });
  logger.info("campaign_created", { campaignId: campaign.id });
  return campaign;
}

export async function ensureCollectionJobs(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  if (!campaign.latitude || !campaign.longitude) {
    await ensureJob({
      type: JobType.GEOCODE_CAMPAIGN,
      campaignId,
      payload: { locationQuery: campaign.locationQuery }
    });
  } else {
    await ensureJob({
      type: JobType.COLLECT_OSM_LEADS,
      campaignId,
      payload: {
        latitude: campaign.latitude,
        longitude: campaign.longitude,
        radiusMeters: campaign.radiusMeters,
        osmCategoryKey: campaign.osmCategoryKey,
        maxLeads: campaign.maxLeads
      }
    });
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.COLLECTING,
      collectionStatus: "queued",
      lastError: null
    }
  });
}

export async function ensureJob(input: {
  type: JobType;
  campaignId?: string | null;
  leadId?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  const existing = await prisma.job.findFirst({
    where: {
      type: input.type,
      campaignId: input.campaignId ?? undefined,
      leadId: input.leadId ?? undefined,
      status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] }
    }
  });
  if (existing) return existing;

  try {
    return await prisma.job.create({
      data: {
        type: input.type,
        campaignId: input.campaignId ?? undefined,
        leadId: input.leadId ?? undefined,
        payload: input.payload
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const active = await prisma.job.findFirst({
        where: {
          type: input.type,
          campaignId: input.campaignId ?? undefined,
          leadId: input.leadId ?? undefined,
          status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] }
        },
        orderBy: { createdAt: "desc" }
      });
      if (active) return active;
    }
    throw error;
  }
}

export async function refreshCampaignStats(campaignId: string) {
  const [campaign, totalLeads, enrichedLeads, leadsWithEmail, highScoreLeads, pendingEnrichment, pendingJobs] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, select: { collectionStatus: true, status: true } }),
    prisma.lead.count({ where: { campaignId } }),
    prisma.lead.count({ where: { campaignId, enrichmentStatus: EnrichmentStatus.FINISHED } }),
    prisma.lead.count({ where: { campaignId, email: { not: null } } }),
    prisma.lead.count({ where: { campaignId, leadScore: { gte: 80 } } }),
    prisma.lead.count({ where: { campaignId, websiteStatus: WebsiteStatus.PENDING, website: { not: null } } }),
    prisma.job.count({ where: { campaignId, status: { in: [JobStatus.PENDING, JobStatus.PROCESSING] } } })
  ]);

  const status =
    campaign.status === CampaignStatus.FAILED
      ? CampaignStatus.FAILED
      : totalLeads === 0 && campaign.collectionStatus === "collected"
        ? CampaignStatus.COMPLETED
        : totalLeads === 0
          ? CampaignStatus.READY
          : pendingEnrichment > 0
        ? CampaignStatus.ENRICHING
        : pendingJobs > 0
          ? CampaignStatus.COLLECTED
          : CampaignStatus.COMPLETED;

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      totalLeads,
      enrichedLeads,
      leadsWithEmail,
      highScoreLeads,
      status,
      collectionStatus: campaign.collectionStatus === "collected" ? "collected" : totalLeads > 0 ? "collected" : campaign.collectionStatus,
      enrichmentStatus: pendingEnrichment > 0 ? "pending" : "complete"
    }
  });
}
