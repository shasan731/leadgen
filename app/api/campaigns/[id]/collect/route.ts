import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/src/server/auth/session";
import { ensureCollectionJobs } from "@/src/server/services/campaign.service";

export const runtime = "nodejs";

export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const campaign = await ensureCollectionJobs(id);
  return NextResponse.json({ campaign });
}
