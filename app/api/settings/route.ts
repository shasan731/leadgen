import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/server/db/prisma";
import { requireApiAuth } from "@/src/server/auth/session";
import { getEditableSettings } from "@/src/server/services/settings.service";

export const runtime = "nodejs";

const settingsSchema = z.object({
  senderName: z.string().max(100).optional(),
  senderCompany: z.string().max(100).optional(),
  senderService: z.string().max(200).optional(),
  userAgentContactEmail: z.string().email().optional().or(z.literal("")),
  defaultBatchSize: optionalNumber(1, 10),
  defaultRadius: optionalNumber(500, 20000),
  attributionText: z.string().max(200).optional()
});

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const settings = await getEditableSettings();
  const filtered = Object.fromEntries(Object.entries(settings).filter(([key]) => !key.startsWith("rate_limit:")));
  return NextResponse.json({ settings: filtered });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings", details: parsed.error.flatten() }, { status: 400 });
  }
  await Promise.all(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value: String(value ?? "") },
        create: { key, value: String(value ?? "") }
      })
    )
  );
  return NextResponse.json({ ok: true });
}

function optionalNumber(min: number, max: number) {
  return z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().int().min(min).max(max).optional()
  );
}
