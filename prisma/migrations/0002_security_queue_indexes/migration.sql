ALTER TYPE "WebsiteStatus" ADD VALUE IF NOT EXISTS 'REDIRECTED_AWAY';

CREATE TABLE IF NOT EXISTS "RateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "value" TEXT,
  "resetAt" TIMESTAMP(3),
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "Job_status_availableAt_idx" ON "Job"("status", "availableAt");
CREATE INDEX IF NOT EXISTS "Lead_campaignId_leadScore_idx" ON "Lead"("campaignId", "leadScore");
CREATE INDEX IF NOT EXISTS "Lead_campaignId_outreachStatus_idx" ON "Lead"("campaignId", "outreachStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "job_active_campaign_type_unique"
  ON "Job" ("type", "campaignId")
  WHERE "leadId" IS NULL AND "campaignId" IS NOT NULL AND "status" IN ('PENDING', 'PROCESSING');

CREATE UNIQUE INDEX IF NOT EXISTS "job_active_lead_type_unique"
  ON "Job" ("type", "leadId")
  WHERE "leadId" IS NOT NULL AND "status" IN ('PENDING', 'PROCESSING');

CREATE UNIQUE INDEX IF NOT EXISTS "lead_unique_domain_per_campaign"
  ON "Lead" ("campaignId", "normalizedDomain")
  WHERE "normalizedDomain" IS NOT NULL;
