import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ols_session";
const PROTECTED_PAGE_PREFIXES = ["/dashboard", "/campaigns", "/leads", "/exports", "/settings"];
const PUBLIC_API_PREFIXES = ["/api/health", "/api/auth/login", "/api/auth/logout", "/api/jobs/process-daily"];
const CSRF_EXEMPT_PREFIXES = ["/api/health", "/api/jobs/process-daily"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const method = request.method.toUpperCase();

  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(method) && !CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const allowedOrigins = new Set([request.nextUrl.origin]);
    if (process.env.APP_BASE_URL) {
      try {
        allowedOrigins.add(new URL(process.env.APP_BASE_URL).origin);
      } catch {
        // Ignore invalid deployment config here; /api/health reports env health.
      }
    }
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const sourceOrigin = origin ?? (referer ? new URL(referer).origin : null);
    if (!sourceOrigin || !allowedOrigins.has(sourceOrigin)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }
  }

  if (PROTECTED_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    if (!hasCookie) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/api/") && !PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!hasCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
