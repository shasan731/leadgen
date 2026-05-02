import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { processJobBatch } from "@/src/server/services/job.service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
  const secret = request.headers.get("x-cron-secret") ?? bearer;
  if (!process.env.CRON_SECRET || !secret || !timingSafeEqual(secret, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const result = await processJobBatch({ limit: 5 });
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
