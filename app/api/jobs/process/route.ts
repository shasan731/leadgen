import { NextRequest, NextResponse } from "next/server";
import { JobType } from "@prisma/client";
import { z } from "zod";
import { requireApiAuth } from "@/src/server/auth/session";
import { processJobBatch } from "@/src/server/services/job.service";
import { prisma } from "@/src/server/db/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const processSchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
  types: z.array(z.nativeEnum(JobType)).optional()
});

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const rateLimit = await checkProcessRateLimit(auth.session.email);
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Please wait before processing another batch" }, { status: 429 });
  }
  const parsed = processSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid process request", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await processJobBatch(parsed.data);
  return NextResponse.json(result);
}

async function checkProcessRateLimit(email: string) {
  const key = `rate_limit:jobs_process:${email}`;
  const existing = await prisma.rateLimit.findUnique({ where: { key } });
  const now = Date.now();
  const last = existing?.value ? Number(existing.value) : 0;
  if (Number.isFinite(last) && now - last < 1000) {
    return { ok: false };
  }
  await prisma.rateLimit.upsert({
    where: { key },
    update: { value: String(now) },
    create: { key, value: String(now) }
  });
  return { ok: true };
}
