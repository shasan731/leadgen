import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/server/db/prisma";
import { requireApiAuth } from "@/src/server/auth/session";

export const runtime = "nodejs";

const draftPatchSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  templateKey: z.string().max(80).optional(),
  status: z.string().max(50).optional()
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const parsed = draftPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft", details: parsed.error.flatten() }, { status: 400 });
  }
  const draft = await prisma.outreachDraft.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ draft });
}
