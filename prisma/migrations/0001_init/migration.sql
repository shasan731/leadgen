CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'READY', 'COLLECTING', 'COLLECTED', 'ENRICHING', 'COMPLETED', 'FAILED');
CREATE TYPE "LeadSource" AS ENUM ('OPENSTREETMAP', 'MANUAL', 'IMPORTED');
CREATE TYPE "EmailStatus" AS ENUM ('UNKNOWN', 'INVALID_FORMAT', 'VALID_FORMAT', 'DOMAIN_FOUND', 'MX_FOUND', 'NO_MX', 'DISPOSABLE', 'RISKY');
CREATE TYPE "WebsiteStatus" AS ENUM ('PENDING', 'CRAWLED', 'FAILED', 'NO_WEBSITE', 'BLOCKED_BY_ROBOTS', 'TIMEOUT');
CREATE TYPE "EnrichmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'FINISHED', 'FAILED', 'SKIPPED');
CREATE TYPE "OutreachStatus" AS ENUM ('NOT_STARTED', 'DRAFT_CREATED', 'APPROVED', 'EXPORTED', 'CONTACTED', 'REPLIED', 'NOT_INTERESTED');
CREATE TYPE "JobType" AS ENUM ('GEOCODE_CAMPAIGN', 'COLLECT_OSM_LEADS', 'ENRICH_LEAD_WEBSITE', 'SCORE_LEAD', 'GENERATE_OUTREACH_DRAFT');
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "businessType" TEXT NOT NULL,
  "osmCategoryKey" TEXT NOT NULL,
  "locationQuery" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "radiusMeters" INTEGER NOT NULL DEFAULT 5000,
  "maxLeads" INTEGER NOT NULL DEFAULT 50,
  "serviceOffer" TEXT,
  "senderName" TEXT,
  "senderCompany" TEXT,
  "senderService" TEXT,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "collectionStatus" TEXT NOT NULL DEFAULT 'pending',
  "enrichmentStatus" TEXT NOT NULL DEFAULT 'pending',
  "totalLeads" INTEGER NOT NULL DEFAULT 0,
  "enrichedLeads" INTEGER NOT NULL DEFAULT 0,
  "leadsWithEmail" INTEGER NOT NULL DEFAULT 0,
  "highScoreLeads" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeocodeCache" (
  "id" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "displayName" TEXT,
  "rawJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "source" "LeadSource" NOT NULL DEFAULT 'OPENSTREETMAP',
  "sourceId" TEXT,
  "sourceType" TEXT,
  "companyName" TEXT,
  "category" TEXT,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "phone" TEXT,
  "website" TEXT,
  "normalizedDomain" TEXT,
  "email" TEXT,
  "socialUrl" TEXT,
  "facebookUrl" TEXT,
  "instagramUrl" TEXT,
  "linkedinUrl" TEXT,
  "youtubeUrl" TEXT,
  "twitterUrl" TEXT,
  "contactPageUrl" TEXT,
  "emailStatus" "EmailStatus" NOT NULL DEFAULT 'UNKNOWN',
  "websiteStatus" "WebsiteStatus" NOT NULL DEFAULT 'PENDING',
  "enrichmentStatus" "EnrichmentStatus" NOT NULL DEFAULT 'PENDING',
  "outreachStatus" "OutreachStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "leadScore" INTEGER NOT NULL DEFAULT 0,
  "opportunitySummary" TEXT,
  "issuesJson" JSONB,
  "tagsJson" JSONB,
  "rawOsmTags" JSONB,
  "notes" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteAudit" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "hasHttps" BOOLEAN NOT NULL DEFAULT false,
  "title" TEXT,
  "metaDescription" TEXT,
  "h1" TEXT,
  "hasContactForm" BOOLEAN NOT NULL DEFAULT false,
  "hasEmail" BOOLEAN NOT NULL DEFAULT false,
  "hasPhone" BOOLEAN NOT NULL DEFAULT false,
  "hasFacebook" BOOLEAN NOT NULL DEFAULT false,
  "hasInstagram" BOOLEAN NOT NULL DEFAULT false,
  "hasLinkedin" BOOLEAN NOT NULL DEFAULT false,
  "hasSchema" BOOLEAN NOT NULL DEFAULT false,
  "hasViewportMeta" BOOLEAN NOT NULL DEFAULT false,
  "loadTimeMs" INTEGER,
  "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
  "issuesJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExtractedEmail" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "domain" TEXT NOT NULL,
  "localPart" TEXT,
  "emailType" TEXT,
  "hasMx" BOOLEAN,
  "status" "EmailStatus" NOT NULL DEFAULT 'UNKNOWN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtractedEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutreachDraft" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutreachDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Job" (
  "id" TEXT NOT NULL,
  "type" "JobType" NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
  "campaignId" TEXT,
  "leadId" TEXT,
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastError" TEXT,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "Campaign_osmCategoryKey_idx" ON "Campaign"("osmCategoryKey");
CREATE INDEX "Campaign_createdAt_idx" ON "Campaign"("createdAt");
CREATE UNIQUE INDEX "GeocodeCache_query_key" ON "GeocodeCache"("query");
CREATE UNIQUE INDEX "Lead_campaignId_sourceId_key" ON "Lead"("campaignId", "sourceId");
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
CREATE INDEX "Lead_normalizedDomain_idx" ON "Lead"("normalizedDomain");
CREATE INDEX "Lead_sourceId_idx" ON "Lead"("sourceId");
CREATE INDEX "Lead_leadScore_idx" ON "Lead"("leadScore");
CREATE INDEX "Lead_enrichmentStatus_idx" ON "Lead"("enrichmentStatus");
CREATE INDEX "WebsiteAudit_leadId_idx" ON "WebsiteAudit"("leadId");
CREATE UNIQUE INDEX "ExtractedEmail_leadId_email_key" ON "ExtractedEmail"("leadId", "email");
CREATE INDEX "ExtractedEmail_leadId_idx" ON "ExtractedEmail"("leadId");
CREATE INDEX "ExtractedEmail_email_idx" ON "ExtractedEmail"("email");
CREATE INDEX "ExtractedEmail_domain_idx" ON "ExtractedEmail"("domain");
CREATE INDEX "OutreachDraft_leadId_idx" ON "OutreachDraft"("leadId");
CREATE INDEX "Job_status_idx" ON "Job"("status");
CREATE INDEX "Job_type_idx" ON "Job"("type");
CREATE INDEX "Job_availableAt_idx" ON "Job"("availableAt");
CREATE INDEX "Job_campaignId_idx" ON "Job"("campaignId");
CREATE INDEX "Job_leadId_idx" ON "Job"("leadId");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebsiteAudit" ADD CONSTRAINT "WebsiteAudit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedEmail" ADD CONSTRAINT "ExtractedEmail_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
