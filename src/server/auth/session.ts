import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "ols_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

function secret() {
  const value = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value || value === "replace-me") {
    throw new Error("SESSION_SECRET must be set");
  }
  return value;
}

function hmac(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(email: string) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${email}:${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${hmac(payload)}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) return null;
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return null;
  let payload: string;
  try {
    payload = Buffer.from(payloadEncoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = hmac(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }
  const [email, expiresAtRaw] = payload.split(":");
  const expiresAt = Number(expiresAtRaw);
  if (!email || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return null;
  }
  return { email, expiresAt };
}

export async function getSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireApiAuth() {
  const session = await getSession();
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const, session };
}
