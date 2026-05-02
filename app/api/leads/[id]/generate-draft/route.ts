import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/server/db/prisma";
import { requireApiAuth } from "@/src/server/auth/session";
import { generateOutreachDraft } from "@/src/server/services/outreach-template.service";
import { getEditableSettings } from "@/src/server/services/settings.service";

export const runtime = "nodejs";

export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const lead = await prisma.lead.findUnique({ where: { id }, include: { campaign: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.leadScore <= 0 && !lead.opportunitySummary) {
    return NextResponse.json({ error: "Score this lead before generating a draft" }, { status: 409 });
  }

  const draft = generateOutreachDraft(lead, lead.campaign, await getEditableSettings());
  const existing = await prisma.outreachDraft.findFirst({ where: { leadId: id }, orderBy: { updatedAt: "desc" } });
  const saved = existing
    ? await prisma.outreachDraft.update({ where: { id: existing.id }, data: draft })
    : await prisma.outreachDraft.create({ data: { leadId: id, ...draft } });
  await prisma.lead.update({ where: { id }, data: { outreachStatus: "DRAFT_CREATED" } });
  return NextResponse.json({ draft: saved });
}
