import type { Lead, WebsiteAudit } from "@prisma/client";
import { EmailStatus } from "@prisma/client";

type ScoringLead = Lead & {
  audits?: WebsiteAudit[];
};

export function calculateLeadScore(lead: ScoringLead, issues: string[], serviceOffer?: string | null) {
  let score = 0;
  const audit = lead.audits?.[0];
  const service = (serviceOffer ?? "").toLowerCase();

  if (lead.companyName) score += 15;
  if (lead.address || (lead.latitude && lead.longitude)) score += 10;
  if (lead.phone) score += 15;
  if (lead.website) score += 20;
  if (lead.email) score += 25;
  if (lead.emailStatus === EmailStatus.MX_FOUND) score += 15;
  if (lead.contactPageUrl) score += 10;
  if (audit?.hasHttps || lead.website?.startsWith("https://")) score += 5;
  if (lead.facebookUrl || lead.instagramUrl || lead.linkedinUrl || lead.socialUrl) score += 5;
  if (lead.category) score += 5;

  if (issues.includes("no_website") && service.includes("website")) score += 10;
  if ((issues.includes("missing_meta_description") || issues.includes("weak_meta_description")) && service.includes("seo")) score += 8;
  if (issues.includes("no_contact_form") && (service.includes("website") || service.includes("lead"))) score += 8;
  if (issues.includes("no_schema_markup") && service.includes("seo")) score += 8;
  if (issues.includes("slow_response") && (service.includes("performance") || service.includes("optimization"))) score += 8;

  if (issues.includes("website_unreachable")) score -= 20;
  if (lead.emailStatus === EmailStatus.INVALID_FORMAT) score -= 25;
  if (!lead.phone && !lead.email) score -= 15;
  if (!lead.companyName) score -= 10;

  return Math.max(0, Math.min(100, score));
}

export function normalizeIssueKeys(issuesJson: unknown): string[] {
  if (!Array.isArray(issuesJson)) return [];
  return issuesJson
    .map((issue) => {
      if (typeof issue === "string") return issue;
      if (issue && typeof issue === "object" && "key" in issue && typeof issue.key === "string") return issue.key;
      return null;
    })
    .filter((issue): issue is string => Boolean(issue));
}
