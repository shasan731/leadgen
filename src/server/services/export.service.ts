import { OutreachStatus, Prisma, type Lead, type Campaign, type OutreachDraft } from "@prisma/client";
import Papa from "papaparse";
import { prisma } from "@/src/server/db/prisma";
import { getLeadQuality } from "@/src/shared/constants/scoring";
import type { CsvLeadRow } from "@/src/shared/types";

export const CSV_COLUMNS = [
  "campaign_name",
  "company_name",
  "category",
  "address",
  "phone",
  "website",
  "email",
  "email_status",
  "lead_score",
  "lead_quality",
  "opportunity_summary",
  "outreach_subject",
  "outreach_body",
  "outreach_status",
  "facebook_url",
  "instagram_url",
  "linkedin_url",
  "contact_page_url",
  "website_issues",
  "created_at"
] satisfies Array<keyof CsvLeadRow>;

export type ExportInput = {
  campaignId?: string | null;
  minScore?: number | null;
  hasEmail?: boolean | null;
  status?: string | null;
};

export type ExportLead = Lead & {
  campaign: Campaign;
  outreachDrafts: OutreachDraft[];
};

export function buildExportWhere(input: ExportInput) {
  const where: Prisma.LeadWhereInput = {};
  if (input.campaignId) where.campaignId = input.campaignId;
  if (typeof input.minScore === "number" && Number.isFinite(input.minScore)) where.leadScore = { gte: input.minScore };
  if (typeof input.hasEmail === "boolean") where.email = input.hasEmail ? { not: null } : null;
  if (input.status && Object.values(OutreachStatus).includes(input.status as OutreachStatus)) {
    where.outreachStatus = input.status as OutreachStatus;
  }
  return where;
}

export async function findExportBatch(where: Prisma.LeadWhereInput, take: number, cursorId?: string) {
  return prisma.lead.findMany({
    where,
    orderBy: [{ leadScore: "desc" }, { id: "asc" }],
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    take,
    include: {
      campaign: true,
      outreachDrafts: { orderBy: [{ status: "asc" }, { updatedAt: "desc" }] }
    }
  });
}

export function leadToCsvRow(lead: ExportLead): CsvLeadRow {
  const draft = lead.outreachDrafts.find((item) => item.status === "approved") ?? lead.outreachDrafts[0];
  return {
    campaign_name: lead.campaign.name,
    company_name: lead.companyName ?? "",
    category: lead.category ?? "",
    address: lead.address ?? "",
    phone: lead.phone ?? "",
    website: lead.website ?? "",
    email: lead.email ?? "",
    email_status: lead.emailStatus,
    lead_score: lead.leadScore,
    lead_quality: getLeadQuality(lead.leadScore).label,
    opportunity_summary: lead.opportunitySummary ?? "",
    outreach_subject: draft?.subject ?? "",
    outreach_body: draft?.body ?? "",
    outreach_status: lead.outreachStatus,
    facebook_url: lead.facebookUrl ?? "",
    instagram_url: lead.instagramUrl ?? "",
    linkedin_url: lead.linkedinUrl ?? "",
    contact_page_url: lead.contactPageUrl ?? "",
    website_issues: Array.isArray(lead.issuesJson)
      ? lead.issuesJson
          .map((issue) => (typeof issue === "object" && issue && "key" in issue ? String(issue.key) : String(issue)))
          .join("; ")
      : "",
    created_at: lead.createdAt.toISOString()
  };
}

export async function exportLeadsCsv(input: ExportInput) {
  const where = buildExportWhere(input);
  const leads = await findExportBatch(where, 50_000);
  const rows = leads.map(leadToCsvRow);
  const csv = Papa.unparse({ fields: CSV_COLUMNS, data: rows }, { quotes: true });
  return { csv, count: rows.length };
}
