import { EmailStatus, EnrichmentStatus, Prisma } from "@prisma/client";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { prisma } from "@/src/server/db/prisma";
import { requireAuth } from "@/src/server/auth/session";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAuth();
  const params = await searchParams;
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } });
  const where = buildLeadWhere(params);
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(params.pageSize ?? 25)));
  const [leads, total, totalAll] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ leadScore: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { campaign: { select: { name: true } } }
    }),
    prisma.lead.count({ where }),
    prisma.lead.count()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">Filter, review, score, and open enriched public business leads.</p>
      </div>

      <LeadFilters campaigns={campaigns} defaults={params} />

      {leads.length ? (
        <>
          <LeadsTable leads={leads} />
          <Pagination page={page} totalPages={totalPages} params={params} />
        </>
      ) : (
        <EmptyState
          title={totalAll === 0 ? "No leads collected yet" : "No leads match these filters"}
          description={totalAll === 0 ? "Open a campaign and collect leads to populate this table." : "Loosen filters or clear them to see available leads."}
        />
      )}
    </div>
  );
}

function Pagination({ page, totalPages, params }: { page: number; totalPages: number; params: Record<string, string | undefined> }) {
  const prev = pageUrl(params, Math.max(1, page - 1));
  const next = pageUrl(params, Math.min(totalPages, page + 1));
  return (
    <div className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <a className={buttonVariants({ variant: "outline", size: "sm", className: page <= 1 ? "pointer-events-none opacity-50" : "" })} href={prev}>
          Previous
        </a>
        <a className={buttonVariants({ variant: "outline", size: "sm", className: page >= totalPages ? "pointer-events-none opacity-50" : "" })} href={next}>
          Next
        </a>
      </div>
    </div>
  );
}

function pageUrl(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") search.set(key, value);
  }
  search.set("page", String(page));
  return `/leads?${search.toString()}`;
}

function buildLeadWhere(params: Record<string, string | undefined>) {
  const where: Prisma.LeadWhereInput = {};
  if (params.campaignId) where.campaignId = params.campaignId;
  if (params.search) {
    where.OR = [
      { companyName: { contains: params.search, mode: "insensitive" } },
      { address: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search, mode: "insensitive" } }
    ];
  }
  if (params.emailStatus && Object.values(EmailStatus).includes(params.emailStatus as EmailStatus)) {
    where.emailStatus = params.emailStatus as EmailStatus;
  }
  if (params.enrichmentStatus && Object.values(EnrichmentStatus).includes(params.enrichmentStatus as EnrichmentStatus)) {
    where.enrichmentStatus = params.enrichmentStatus as EnrichmentStatus;
  }
  if (params.minScore) where.leadScore = { gte: Number(params.minScore) };
  if (params.hasEmail === "true") where.email = { not: null };
  if (params.hasEmail === "false") where.email = null;
  if (params.hasWebsite === "true") where.website = { not: null };
  if (params.hasWebsite === "false") where.website = null;
  if (params.hasPhone === "true") where.phone = { not: null };
  if (params.hasPhone === "false") where.phone = null;
  if (params.quality) {
    const range = qualityRange(params.quality);
    if (range) where.leadScore = range;
  }
  return where;
}

function qualityRange(quality: string): Prisma.IntFilter | null {
  if (quality === "Hot") return { gte: 80, lte: 100 };
  if (quality === "Good") return { gte: 60, lte: 79 };
  if (quality === "Medium") return { gte: 40, lte: 59 };
  if (quality === "Low") return { gte: 0, lte: 39 };
  return null;
}
