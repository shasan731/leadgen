import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/server/db/prisma";
import { requireApiAuth } from "@/src/server/auth/session";
import { campaignPatchSchema } from "@/src/shared/schemas/campaign.schema";

export const runtime = "nodejs";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      leads: { orderBy: { leadScore: "desc" }, take: 10 },
      jobs: { orderBy: { createdAt: "desc" }, take: 25 }
    }
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const parsed = campaignPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign update", details: parsed.error.flatten() }, { status: 400 });
  }
  const campaign = await prisma.campaign.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ campaign });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  await prisma.campaign.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
