import { NextResponse } from "next/server";
import { prisma } from "@/src/server/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const missing = ["DATABASE_URL", "APP_USER_AGENT"].filter((key) => !process.env[key]);
    if (!process.env.SESSION_SECRET && !process.env.NEXTAUTH_SECRET) missing.push("SESSION_SECRET");
    if (missing.length) {
      return NextResponse.json({ ok: false, env: "error", missing }, { status: 503 });
    }
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, db: "error", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
