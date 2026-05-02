import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/src/server/auth/session";
import { verifyPassword } from "@/src/server/auth/password";
import { prisma } from "@/src/server/db/prisma";

export const runtime = "nodejs";

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let email = "";
  let password = "";
  let next = "/dashboard";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    email = String(body.email ?? "");
    password = String(body.password ?? "");
    next = String(body.next ?? "/dashboard");
  } else {
    const form = await request.formData();
    email = String(form.get("email") ?? "");
    password = String(form.get("password") ?? "");
    next = String(form.get("next") ?? "/dashboard");
  }

  const expectedEmail = process.env.APP_USER_EMAIL;
  const expectedHash = process.env.APP_USER_PASSWORD_HASH;
  const throttle = await checkLoginThrottle(request);
  if (!throttle.ok) {
    return NextResponse.json({ error: "Too many login attempts" }, { status: 429, headers: { "retry-after": String(throttle.retryAfterSeconds) } });
  }

  if (!expectedEmail || !expectedHash || email !== expectedEmail || !verifyPassword(password, expectedHash)) {
    await recordLoginFailure(request);
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "invalid");
    return NextResponse.redirect(login, { status: 303 });
  }

  await clearLoginFailures(request);
  const safeNext = sanitizeNextPath(next, request.url);
  const response = NextResponse.redirect(new URL(safeNext, request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE, createSessionToken(email), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return response;
}

function sanitizeNextPath(next: string, requestUrl: string) {
  const base = new URL(process.env.APP_BASE_URL ?? requestUrl);
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes(":")) return "/dashboard";
  const url = new URL(next, base);
  if (url.origin !== base.origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//") || url.pathname.includes("\\")) return "/dashboard";
  return `${url.pathname}${url.search}${url.hash}`;
}

async function checkLoginThrottle(request: NextRequest) {
  const key = loginKey(request);
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  const now = Date.now();
  if (row?.blockedUntil && row.blockedUntil.getTime() > now) {
    return { ok: false as const, retryAfterSeconds: Math.ceil((row.blockedUntil.getTime() - now) / 1000) };
  }
  return { ok: true as const };
}

async function recordLoginFailure(request: NextRequest) {
  const key = loginKey(request);
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });
  const resetAt = existing?.resetAt && existing.resetAt > now ? existing.resetAt : new Date(Date.now() + LOGIN_WINDOW_MS);
  const count = existing?.resetAt && existing.resetAt > now ? existing.count + 1 : 1;
  await prisma.rateLimit.upsert({
    where: { key },
    update: {
      count,
      resetAt,
      blockedUntil: count >= MAX_LOGIN_FAILURES ? new Date(Date.now() + LOGIN_BLOCK_MS) : null
    },
    create: { key, count, resetAt }
  });
}

async function clearLoginFailures(request: NextRequest) {
  await prisma.rateLimit.deleteMany({ where: { key: loginKey(request) } });
}

function loginKey(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  return `login:${ip}`;
}
