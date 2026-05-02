import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/server/db/prisma";
import { requireApiAuth } from "@/src/server/auth/session";
import { leadPatchSchema } from "@/src/shared/schemas/lead.schema";

export const runtime = "nodejs";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      campaign: true,
      audits: { orderBy: { createdAt: "desc" } },
      extractedEmails: { orderBy: { createdAt: "desc" } },
      outreachDrafts: { orderBy: { updatedAt: "desc" } }
    }
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json({ lead });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const parsed = leadPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead update", details: parsed.error.flatten() }, { status: 400 });
  }
  const lead = await prisma.lead.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ lead });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
