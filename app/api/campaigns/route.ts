import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/server/db/prisma";
import { requireApiAuth } from "@/src/server/auth/session";
import { campaignCreateSchema } from "@/src/shared/schemas/campaign.schema";
import { createCampaign } from "@/src/server/services/campaign.service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { leads: true, jobs: true }
      }
    }
  });
  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const parsed = campaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign", details: parsed.error.flatten() }, { status: 400 });
  }

  const campaign = await createCampaign(parsed.data);
  return NextResponse.json({ campaign }, { status: 201 });
}
