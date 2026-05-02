import { NextRequest, NextResponse } from "next/server";
import { EmailStatus, EnrichmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { requireApiAuth } from "@/src/server/auth/session";
import { leadQuerySchema } from "@/src/shared/schemas/lead.schema";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = leadQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead query", details: parsed.error.flatten() }, { status: 400 });
  }

  const query = parsed.data;
  const where: Prisma.LeadWhereInput = {};
  if (query.campaignId) where.campaignId = query.campaignId;
  if (query.search) {
    where.OR = [
      { companyName: { contains: query.search, mode: "insensitive" } },
      { address: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } }
    ];
  }
  if (query.emailStatus && Object.values(EmailStatus).includes(query.emailStatus as EmailStatus)) {
    where.emailStatus = query.emailStatus as EmailStatus;
  }
  if (query.enrichmentStatus && Object.values(EnrichmentStatus).includes(query.enrichmentStatus as EnrichmentStatus)) {
    where.enrichmentStatus = query.enrichmentStatus as EnrichmentStatus;
  }
  if (typeof query.minScore === "number") where.leadScore = { gte: query.minScore };
  if (typeof query.hasEmail === "boolean") where.email = query.hasEmail ? { not: null } : null;
  if (typeof query.hasWebsite === "boolean") where.website = query.hasWebsite ? { not: null } : null;
  if (typeof query.hasPhone === "boolean") where.phone = query.hasPhone ? { not: null } : null;
  if (query.quality) {
    const range = qualityRange(query.quality);
    where.leadScore = { gte: range.min, lte: range.max };
  }

  const [items, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ leadScore: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { campaign: { select: { name: true } } }
    }),
    prisma.lead.count({ where })
  ]);

  return NextResponse.json({ items, total, page: query.page, pageSize: query.pageSize });
}

function qualityRange(quality: "Hot" | "Good" | "Medium" | "Low") {
  switch (quality) {
    case "Hot":
      return { min: 80, max: 100 };
    case "Good":
      return { min: 60, max: 79 };
    case "Medium":
      return { min: 40, max: 59 };
    case "Low":
      return { min: 0, max: 39 };
  }
}
