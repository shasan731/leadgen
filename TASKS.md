# OpenLead Scout — Engineering & QA Task List

A prioritized backlog of bugs, security issues, inconsistencies, UX problems, and improvements found during a senior engineer + QA review of the codebase. Each task lists impacted files, what's wrong, the suggested fix, and why it matters.

> Severity legend: **P0 Critical** (security / data correctness / blocks core flow) · **P1 High** (clear bug or notably wrong behaviour) · **P2 Medium** (correctness or UX issue) · **P3 Low / Polish** · **P4 New Feature** (free / no-paid-API additions consistent with the project charter).

---

## P0 — Critical

### P0-1 — Crawler kills enrichment for legitimate subdomain redirects
**Files:** [src/server/services/crawler.service.ts:65-109](src/server/services/crawler.service.ts#L65-L109), [src/server/utils/domain.ts](src/server/utils/domain.ts)
**Problem:** The crawler compares the redirect's final hostname against the originally-supplied domain after only stripping `www.`. When a site naturally redirects (`example.com` → `shop.example.com`, or `example.com` → `example.co.uk` when the OSM tag was wrong scheme), the crawler throws "Redirected outside the business domain" and silently drops the page. Many real businesses use this pattern (e.g. Wix/Shopify/Squarespace storefronts).
**Fix:**
- Compare apex domains (eTLD+1) using a public-suffix list (`tldts` is MIT-licensed and free) or accept any subdomain of the registrable domain.
- If the redirect lands on a totally different apex, record `websiteStatus = REDIRECTED_AWAY` (new enum value) and store the new domain so the user can decide.
- Surface this as a website-issue (`redirected_off_domain`) instead of throwing.
**Why:** Today this silently nukes audits for a large fraction of leads with no diagnostic.

### P0-2 — SSRF: DNS rebinding / TOCTOU between resolve and fetch
**Files:** [src/server/utils/fetch-with-timeout.ts:24-66](src/server/utils/fetch-with-timeout.ts#L24-L66), [src/server/utils/domain.ts:17-28](src/server/utils/domain.ts#L17-L28)
**Problem:** `resolvePublicAddresses` uses `dns.lookup`, but the subsequent `fetch()` call performs its **own** DNS lookup. A malicious DNS server can answer the first lookup with a public IP and the second with `169.254.169.254` (cloud metadata) or `127.0.0.1`. The redirect chain re-runs the same vulnerable check at each hop.
**Fix:**
- Resolve once, pin the connection to the resolved IP (use `undici.Agent` with a custom `connect` that overrides DNS, set the `Host` header to the original hostname, and validate TLS using SNI = original hostname).
- Re-validate the resolved IP at every redirect hop.
- Add an integration test that uses a TTL-0 DNS server returning private IPs to prove rebinding is rejected.
**Why:** Metadata endpoint exfiltration on Vercel/AWS is a real, classic SSRF risk for any app that fetches user-supplied URLs.

### P0-3 — SSRF: IPv4-mapped IPv6 and other reserved ranges not blocked
**File:** [src/server/utils/domain.ts:38-64](src/server/utils/domain.ts#L38-L64)
**Problem:** `isPublicIpv6` does not block `::ffff:127.0.0.1` (IPv4-mapped IPv6), `64:ff9b::/96` (NAT64 to private), `2002:` (6to4 mapping to private v4), Teredo `2001::/32`, multicast `ff00::/8`. Also missing explicit `0.0.0.0` block in `isPublicIpv4`.
**Fix:** Parse IPv6 as a 16-byte address (`net.isIPv6` + manual byte parsing) and reject:
- `::1`, `::`, `::ffff:0:0/96` (when mapped v4 is private), `64:ff9b::/96`, `100::/64`, `2001::/32` (Teredo), `2002::/16` (when embedded v4 is private), `fc00::/7`, `fe80::/10`, `ff00::/8`.
- Also add `0.0.0.0/8` and `100.64.0.0/10` (CGNAT) explicitly to v4 (latter already partially handled).
**Why:** Any of these forms can route to private/loopback and bypass the current allow-list.

### P0-4 — CSRF protection is absent on all state-changing endpoints
**Files:** [middleware.ts](middleware.ts), every `app/api/**/route.ts`
**Problem:** Session cookie is `SameSite=Lax`, which still permits cross-site **top-level** form POSTs. Any page on the internet can:
- Submit a form to `/api/auth/logout` to log the user out (DoS).
- Submit a form to mutating endpoints if any accept form-encoded bodies.
**Fix:**
- Add an `Origin` / `Referer` allow-list check in `middleware.ts` for non-GET, non-HEAD requests on `/api/**`. Reject when origin is missing or doesn't match `APP_BASE_URL`.
- Consider switching the session cookie to `SameSite=Strict` since this is a single-user admin app with no third-party flows.
- Add a double-submit cookie token for forms in `Header` (logout) and the future Settings save form if you switch from `fetch`.
**Why:** Lax cookies do not stop top-level POSTs.

### P0-5 — Job lock has no fencing token; stale-lock recovery can double-process
**File:** [src/server/services/job.service.ts:28-58](src/server/services/job.service.ts#L28-L58)
**Problem:** `releaseStaleJobs` resets jobs older than 10 minutes back to PENDING. If the original worker is still alive and finally calls `completeJob` (or `failJob`), it will overwrite a row that may already have been re-locked and processed by a second worker. Result: duplicate enrichments, duplicate Overpass calls, duplicate drafts.
**Fix:**
- On every transition (`completeJob`, `failJob`, `retryJob`), add `where: { id, lockedBy: workerId, status: "PROCESSING" }` so a worker can only complete the job it actually owns. If the count is 0, log "stale-completion-ignored" and skip.
- Also generate a fresh `workerId` (e.g. `nanoid()`) per `processJobBatch` call rather than per process.
**Why:** Without fencing, the queue is not exactly-once-ish; it's at-least-twice under stale-recovery.

### P0-6 — Concurrent "Collect" clicks can create duplicate jobs (no DB constraint)
**Files:** [src/server/services/campaign.service.ts:32-90](src/server/services/campaign.service.ts#L32-L90), [components/campaigns/CampaignStatusCard.tsx:16-24](components/campaigns/CampaignStatusCard.tsx#L16-L24)
**Problem:** `ensureJob` does `findFirst` then `create` non-atomically. Two concurrent requests both miss, both create. There is no DB-level uniqueness preventing duplicate `(type, campaignId)` PENDING/PROCESSING rows.
**Fix:**
- Add a partial unique index in a migration:
  `CREATE UNIQUE INDEX job_active_per_campaign_type ON "Job" (type, "campaignId") WHERE status IN ('PENDING','PROCESSING');`
- Wrap `ensureJob` in `prisma.$transaction(..., { isolationLevel: "Serializable" })` and treat the `P2002` unique-violation as "already enqueued, return existing".
**Why:** Doubles Overpass usage, can cause rate-limiting and partial dedup.

### P0-7 — `ensureJob` treats COMPLETED as still-existing — re-running collection is impossible
**File:** [src/server/services/campaign.service.ts:72-90](src/server/services/campaign.service.ts#L72-L90)
**Problem:** `ensureJob` returns the existing row when `status ∈ {PENDING, PROCESSING, COMPLETED}`. Once `COLLECT_OSM_LEADS` succeeds the user can never re-collect to pick up new POIs.
**Fix:**
- Exclude `COMPLETED` from the existence check, **or** add an explicit "Re-run collection" UI action that creates a fresh job (and gates by `status` to prevent stomping in-flight work).
- If you keep the dedup, add a clear UI message like "Already collected — click 'Re-run collection' to refresh from OpenStreetMap".
**Why:** Usability dead-end; the app appears broken because the button silently no-ops.

### P0-8 — Open-redirect via `next` parameter on login
**File:** [app/api/auth/login/route.ts:28-37](app/api/auth/login/route.ts#L28-L37)
**Problem:** `safeNext` only checks `next.startsWith("/") && !next.startsWith("//")`. It accepts paths like `/\evil.com` which some browsers normalise into a host. It does not parse the URL.
**Fix:**
- Build the redirect with `new URL(next, APP_BASE_URL)` and assert `result.origin === new URL(APP_BASE_URL).origin`.
- Reject anything containing `\\`, `:` outside expected positions, or whose pathname does not match `/^\/[^/\\]/`.
**Why:** Phishing pivot — attacker sends `…/login?next=/\evil.com/login` then steals creds.

### P0-9 — `next.config.ts` defines no security headers (CSP, HSTS, frame, referrer)
**File:** [next.config.ts](next.config.ts)
**Problem:** No CSP, no HSTS, no `X-Frame-Options`, no `Referrer-Policy`, no `X-Content-Type-Options`. The dashboard is iframable; any reflected XSS escalates further than necessary.
**Fix:** Add a `headers()` block:
```ts
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }
    ]
  }];
}
```
**Why:** Cheap, free, large defence-in-depth win.

### P0-10 — Stored XSS sink: scraped URLs rendered in `<a href>` without protocol whitelist
**Files:** [components/leads/LeadsTable.tsx:43-49](components/leads/LeadsTable.tsx#L43-L49), [components/leads/LeadDetail.tsx](components/leads/LeadDetail.tsx)
**Problem:** `lead.website`, `lead.contactPageUrl`, `lead.facebookUrl`, etc. are scraped from the open web (and OSM contributors) and rendered into `<a href={value}>`. React 19 blocks `javascript:` URLs at runtime but logs a warning and earlier React versions did not. Better to validate at write-time.
**Fix:**
- Server-side: in extractors, refuse any URL whose protocol isn't `http:`/`https:`. Persist only validated URLs.
- Client-side: still defensively wrap in a small `<SafeLink href={...}>` component that re-checks protocol.
**Why:** Defence in depth — the data source (OSM tags + scraped HTML) is partially adversarial.

---

## P1 — High

### P1-1 — `extractEmailsFromText` obfuscation decoder generates phantom emails from normal prose
**File:** [src/server/services/email-extractor.service.ts:51-59](src/server/services/email-extractor.service.ts#L51-L59)
**Problem:** `replace(/\s+at\s+/gi, "@")` corrupts ordinary text. "We met at home in 2024 dot com" becomes `met@home in 2024.com`. False-positive emails go through MX validation and into the DB.
**Fix:**
- Only apply `at` / `dot` substitution inside a tight token window — e.g. require the entire decoded string to match the existing email regex AND be wrapped in `()` / `[]` or be on a line of length ≤ 80 chars without other `[a-z]+ at [a-z]+` neighbours.
- Easier rule: only run obfuscation regex on text where `@`-like character (`[at]`, `(at)`) is found. Do NOT run on bare ` at `.

### P1-2 — robots.txt parser is RFC-non-compliant (multi-UA blocks lost, Allow ignored, no wildcards)
**File:** [src/server/services/robots.service.ts:33-50](src/server/services/robots.service.ts#L33-L50)
**Problem:** Sets `applies = (value === "*")` on every `User-agent` line, so stacked headers like:
```
User-agent: *
User-agent: Bingbot
Disallow: /
```
fail to apply the disallow to us. Also ignores `Allow:` directives entirely and does not honour `*`/`$` wildcards in paths.
**Fix:** Either ship a tiny RFC 9309 parser or use the free `robots-parser` package (MIT). At minimum: stack consecutive `User-agent:` lines into a group, support `Allow:`, and pick the longest matching rule.

### P1-3 — `robotsCache` is unbounded and never expires
**File:** [src/server/services/robots.service.ts:3](src/server/services/robots.service.ts#L3)
**Problem:** Plain `Map` growing forever. Robots.txt up to 100KB per entry. In dev or long-running serverless instances this leaks; stale rules served indefinitely.
**Fix:** Wrap in an LRU with `max=500` and `ttl=24h` (use `lru-cache`, free, MIT).

### P1-4 — Email validation re-resolves DNS for every email of a domain
**Files:** [src/server/services/email-validation.service.ts](src/server/services/email-validation.service.ts), [src/server/services/crawler.service.ts:130-159](src/server/services/crawler.service.ts#L130-L159)
**Problem:** For each candidate email, MX is re-queried sequentially. Crawler awaits each one in serial. Slow.
**Fix:**
- Cache resolved MX/A status per-domain inside a per-job in-memory `Map`.
- Use `Promise.allSettled` to validate all unique domains in parallel before classifying emails.

### P1-5 — Phone regex matches addresses, ZIPs, prices, and years
**File:** [src/server/services/phone-extractor.service.ts:1-2](src/server/services/phone-extractor.service.ts#L1-L2)
**Problem:** The regex `/(?:\+?\d{1,4}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}(?:[\s.-]?\d{1,5})?/g` matches "10001 New York" or "$100,000-200,000".
**Fix:**
- Always prefer `<a href="tel:…">` first (already extracted but not preferentially picked).
- For free-text, require a leading anchor word (`tel`, `phone`, `call`, `mobile`, `whatsapp`, `+`).
- Adopt **libphonenumber-js** (MIT, free) for validation and `findNumbers` (does the heavy lifting and avoids most false positives).

### P1-6 — Partial bodies dropped on 307/308 redirects in `safeFetchText`
**File:** [src/server/utils/fetch-with-timeout.ts:44-48](src/server/utils/fetch-with-timeout.ts#L44-L48)
**Problem:** `body: redirectCount === 0 ? options.body : undefined`. Per HTTP semantics, 307/308 require re-sending the original body and method. Currently irrelevant for the GET-only crawler but a footgun for future POST callers.
**Fix:** Distinguish 301/302/303 (drop body, switch to GET) from 307/308 (preserve method+body).

### P1-7 — Redirect cap of 3 is too low; some real chains exceed it
**File:** [src/server/utils/fetch-with-timeout.ts:69](src/server/utils/fetch-with-timeout.ts#L69)
**Problem:** Many sites redirect 3+ times (canonical → www → https → trailing slash → CDN).
**Fix:** Bump to 5 (still safe). Document the limit.

### P1-8 — Crawler does not dedupe identical final URLs across attempted paths
**File:** [src/server/services/crawler.service.ts:65-109](src/server/services/crawler.service.ts#L65-L109)
**Problem:** `/contact-us` redirecting to `/contact` causes both to be fetched; the same page is parsed twice; emails are double-counted into `pickBestEmail`.
**Fix:** Track a `Set<string>` of `finalUrl` (normalised) per crawl; skip if already seen.

### P1-9 — `lead.email` overwritten by website-extracted email without preserving the OSM-supplied one in `ExtractedEmail`
**File:** [src/server/services/crawler.service.ts:196-216](src/server/services/crawler.service.ts#L196-L216)
**Problem:** If OSM provided an email and the crawler finds a different one, the OSM email is replaced silently. `processCollectOsmLeads` writes the OSM email into `ExtractedEmail` only at collection time, so this is partially OK — but if a later re-enrichment runs, the OSM email still gets shadowed without a "source" reason.
**Fix:** Always upsert any candidate email into `ExtractedEmail` with `sourceUrl = "osm"` or the page URL; pick `lead.email` deterministically with explicit precedence rules; document them.

### P1-10 — `refreshCampaignStats` overwrites status set by callers; race with `processCollectOsmLeads`
**Files:** [src/server/services/campaign.service.ts:92-120](src/server/services/campaign.service.ts#L92-L120), [src/server/services/job.service.ts:311-313](src/server/services/job.service.ts#L311-L313)
**Problem:** After collection, `refreshCampaignStats` is called (which may set `ENRICHING`/`COMPLETED`), then the caller writes `COLLECTED` back. The campaign appears stuck at `COLLECTED` until the next refresh.
**Fix:** Make `refreshCampaignStats` the single source of truth for status transitions. Callers should never write `status` directly; they should signal intent (`requestStatusBump("COLLECTED")`) and let the recompute decide.

### P1-11 — Zero-result collection is reported as `READY` (looks like nothing happened)
**File:** [src/server/services/campaign.service.ts:101-106](src/server/services/campaign.service.ts#L101-L106)
**Problem:** A campaign that ran collection and found zero leads is indistinguishable from one that has not run yet.
**Fix:** Add `COMPLETED_EMPTY` state (or simply `COMPLETED` when `collectionStatus === 'completed'` regardless of count). Show a banner: "Collection ran but no businesses were found. Try increasing radius or changing category."

### P1-12 — Settings: stored values are decorative — never applied
**Files:** [components/layout/SettingsForm.tsx:46-48](components/layout/SettingsForm.tsx#L46-L48), [src/server/services/outreach-template.service.ts:163-172](src/server/services/outreach-template.service.ts#L163-L172), [components/campaigns/CampaignForm.tsx](components/campaigns/CampaignForm.tsx), [components/campaigns/CampaignStatusCard.tsx](components/campaigns/CampaignStatusCard.tsx), [app/layout.tsx:21](app/layout.tsx#L21)
**Problem:** `senderName`, `senderCompany`, `senderService` are read from `Campaign` columns, not `AppSetting`. `attributionText` is stored but the footer is hard-coded. `defaultBatchSize` and `defaultRadius` are saved but never consumed.
**Fix:**
- Have `outreach-template.service` fall back to `AppSetting` when the campaign columns are blank.
- Pull footer attribution from `AppSetting` server-side (or just stop offering it as editable).
- `CampaignForm` should default radius/batch from settings (server-rendered).
- `CampaignStatusCard` should read default batch size from a shared config endpoint or hydrate from settings.

### P1-13 — Settings GET returns ALL keys, including `rate_limit:*` (which embeds the user email)
**Files:** [app/api/settings/route.ts:18-23](app/api/settings/route.ts#L18-L23), [app/api/jobs/process/route.ts:32](app/api/jobs/process/route.ts#L32)
**Problem:** The `AppSetting` table doubles as a rate-limit store. Keys like `rate_limit:jobs_process:admin@example.com` are returned by `GET /api/settings`.
**Fix:**
- Move rate-limit timestamps into a separate `RateLimit` table (or a Postgres unlogged table) so `AppSetting` is purely user-editable config.
- In the meantime, filter out keys starting with `rate_limit:` in the GET handler.

### P1-14 — CSV export has no header row when result set is empty
**File:** [src/server/services/export.service.ts](src/server/services/export.service.ts)
**Problem:** `Papa.unparse([])` emits `""`. Users get a 0-byte file labelled `.csv` with no columns and no error.
**Fix:** Always pass `Papa.unparse({ fields: COLUMNS, data: rows })` so headers are emitted regardless of data.

### P1-15 — CSV export is unbounded in memory and response size
**File:** [src/server/services/export.service.ts](src/server/services/export.service.ts)
**Problem:** No `take` limit. Vercel responses are capped at ~4.5 MB; large campaigns will hit the cap. Also blocks the event loop while serialising.
**Fix:**
- Stream the CSV using `ReadableStream` in the route handler. Iterate Prisma in batches of 500 with `cursor` pagination.
- Add a hard upper bound (e.g. 50k rows) and document it.

### P1-16 — CSV export ignores `OutreachDraft.status`
**File:** [src/server/services/export.service.ts:31-32, 44-45](src/server/services/export.service.ts#L31-L45)
**Problem:** Picks the latest draft by `updatedAt` regardless of approval status, even though leads may already have been edited and approved.
**Fix:** Prefer drafts where `status === "approved"`; fall back to the most recent draft only when none are approved. Add a column `outreach_status` to disambiguate.

### P1-17 — No login throttling
**File:** [app/api/auth/login/route.ts](app/api/auth/login/route.ts)
**Problem:** scrypt slows brute force but does not stop it. Single-user app makes lockout trivial: throttle by IP and lock account after N consecutive failures.
**Fix:** Track failed attempts in a `LoginAttempt` table (or reuse the rate-limit table). After 5 failures within 10 minutes from an IP, return 429 for the next 15 minutes. Send `Retry-After` header.

### P1-18 — `defaultBatchSize` / `defaultRadius` settings reject empty input (NaN)
**File:** [src/server/utils/validation/settings.schema.ts](src/server/utils/validation/settings.schema.ts) (or wherever `settingsSchema` lives), [components/layout/SettingsForm.tsx:14-26](components/layout/SettingsForm.tsx#L14-L26)
**Problem:** `z.coerce.number().int().min(1).optional()` coerces `""` → `NaN`, fails validation, the user gets a generic error if they leave the field blank.
**Fix:** `z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int().min(1).max(20).optional())`. Same for `defaultRadius`.

### P1-19 — `cron secret` accepted via query string (logged on edges/CDN)
**File:** [app/api/jobs/process-daily/route.ts:8-13](app/api/jobs/process-daily/route.ts#L8-L13)
**Problem:** Query strings are typically captured by access logs.
**Fix:**
- Accept the secret only via header (`Authorization: Bearer ...` or Vercel's `x-vercel-cron-signature`).
- Compare with `crypto.timingSafeEqual`.
- Set `Cache-Control: no-store`.

### P1-20 — `requireApiAuth` doesn't refresh the cookie; users get logged out mid-task
**File:** [src/server/auth/session.ts](src/server/auth/session.ts)
**Problem:** Fixed 12h TTL, no rolling. A user actively working will hit a hard expiry.
**Fix:** When session is more than half-aged, re-issue the cookie with a refreshed `exp` on the response.

### P1-21 — Login error param reflected verbatim into the page
**File:** [app/login/page.tsx:35](app/login/page.tsx#L35)
**Problem:** `?error=...` is rendered as text. React escapes HTML, but attackers can craft phishing copy ("Your account is suspended, call 1-800-...").
**Fix:** Replace with a code map: `?error=invalid` → "Invalid credentials." Reject unknown codes.

### P1-22 — `processCollectOsmLeads` does not respect `maxLeads` against existing rows on re-run
**File:** [src/server/services/job.service.ts:198-316](src/server/services/job.service.ts#L198-L316)
**Problem:** Slices Overpass output by `maxLeads`; doesn't account for previously inserted leads. Combined with P0-7, re-runs (when allowed) can blow past the cap.
**Fix:** Compute remaining budget = `maxLeads - lead.count(where: campaignId)`, then slice to that.

### P1-23 — Mobile menu is decorative (hamburger has no behaviour)
**Files:** [components/layout/Header.tsx:10](components/layout/Header.tsx#L10), [components/layout/Sidebar.tsx:13](components/layout/Sidebar.tsx#L13)
**Problem:** Sidebar is `hidden md:block`. The `Menu` icon in `Header` has no `onClick`; mobile users cannot navigate.
**Fix:** Convert sidebar into a slide-over Sheet (shadcn/ui has one) controlled by a state hook; bind to the existing icon.

### P1-24 — `OutreachDraftCard` swallows server errors and reports success regardless
**File:** [components/leads/OutreachDraftCard.tsx:24-45](components/leads/OutreachDraftCard.tsx#L24-L45)
**Problem:** `save()` does not check `response.ok`; the user is told "Draft saved" even on 400/500. `regenerate()` similarly has no error path.
**Fix:** Read `response.ok`, surface server error JSON, show toast on failure. Add a `useToast()` (shadcn) so feedback is consistent.

### P1-25 — `/leads` page has no pagination UI even though API supports it
**File:** [app/leads/page.tsx:22](app/leads/page.tsx#L22)
**Problem:** Hard-coded `take: 100`. Campaigns with 200 leads cap silently; users assume the rest aren't there.
**Fix:** Wire `page`/`pageSize` query params, render a "Page X of Y · Next/Prev" footer; preserve filter state across pages.

### P1-26 — `/api/leads/[id]/generate-draft` runs even on unscored leads
**File:** [app/api/leads/[id]/generate-draft/route.ts](app/api/leads/[id]/generate-draft/route.ts)
**Problem:** Drafts get generated with score=0 / no opportunity summary, producing junk copy.
**Fix:** Return 409 if the lead has not been scored; offer a "Score now" button in the UI.

### P1-27 — Unique constraint workaround for `(campaignId, normalizedDomain)` not enforced
**Files:** [prisma/schema.prisma](prisma/schema.prisma), [src/server/services/job.service.ts](src/server/services/job.service.ts)
**Problem:** Spec said "handle in service logic if Prisma partial unique is hard." Today neither is implemented; two leads with the same domain in the same campaign can co-exist (e.g. an OSM duplicate or a re-run after we fix P0-7).
**Fix:** Add a raw SQL partial unique index: `CREATE UNIQUE INDEX lead_unique_domain_per_campaign ON "Lead" ("campaignId", "normalizedDomain") WHERE "normalizedDomain" IS NOT NULL;`. Catch P2002 in the upsert path and merge instead of failing.

---

## P2 — Medium

### P2-1 — Missing composite indexes for hot queries
**File:** [prisma/schema.prisma](prisma/schema.prisma)
- `Job (status, availableAt)` — used by `processJobBatch.findFirst`.
- `Lead (campaignId, leadScore)` — used by lead listing & scoring filters.
- `Lead (campaignId, outreachStatus)` — used by export filters.
**Fix:** Add composite indexes in a migration.

### P2-2 — Three overlapping campaign status fields
**File:** [prisma/schema.prisma:35,87](prisma/schema.prisma#L35)
**Problem:** `Campaign.status` (enum) plus `Campaign.collectionStatus` and `Campaign.enrichmentStatus` (free-form strings). These can disagree.
**Fix:** Drop the two strings; derive everything from `status` plus aggregate counts. Update `refreshCampaignStats` accordingly.

### P2-3 — `User` table is unused (auth uses env-based single user) — remove or wire up
**File:** [prisma/schema.prisma](prisma/schema.prisma)
**Problem:** Confusing; new contributors expect login to read `User`. Spec leaves both options open.
**Fix:** Pick one: either delete the model or migrate auth onto it (so multi-user is possible later).

### P2-4 — `NEXTAUTH_SECRET` env var name is misleading
**File:** [.env.example](.env.example)
**Problem:** No NextAuth.js is used; this is the HMAC key for the home-grown session token.
**Fix:** Rename to `SESSION_SECRET` (provide a small migration step that reads either name during transition).

### P2-5 — `WebsiteAudit` accumulates one row per crawl with no "current" pointer
**File:** [prisma/schema.prisma](prisma/schema.prisma)
**Problem:** Re-enriching a lead leaves multiple audits; `LeadDetail` reads `[0]` after `orderBy: createdAt desc` — works but DB grows unbounded and the view sometimes reads stale joins.
**Fix:** Either (a) overwrite (single audit per lead) by upserting on `leadId`, or (b) keep history but add `Lead.currentAuditId` pointer for fast reads.

### P2-6 — `Lead.socialUrl` denormalises against `facebookUrl/instagramUrl/...`
**File:** [prisma/schema.prisma](prisma/schema.prisma)
**Problem:** Picks "any social link" but can drift from the typed columns.
**Fix:** Either drop `socialUrl` (compute on read) or define it as the canonical "primary" social and enforce in extractor.

### P2-7 — No `error.tsx` / `loading.tsx` / `not-found.tsx` boundaries
**File:** entire `app/` tree
**Problem:** Any thrown error renders Next's default error page; transient failures take down the whole route.
**Fix:** Add per-segment `error.tsx` with retry button and `loading.tsx` skeletons for `/dashboard`, `/campaigns`, `/leads`, `/leads/[id]`.

### P2-8 — No `.dark` CSS variables defined; dark mode toggle is impossible despite Tailwind config
**Files:** [tailwind.config.ts](tailwind.config.ts), [app/globals.css](app/globals.css)
**Problem:** `darkMode: ["class"]` is set but `globals.css` has no `.dark { … }` block.
**Fix:** Define dark-mode tokens; add a small theme toggle component using `prefers-color-scheme` as default.

### P2-9 — Sidebar items don't show active state
**File:** [components/layout/Sidebar.tsx](components/layout/Sidebar.tsx)
**Fix:** Use `usePathname()` and apply `bg-muted` / `text-foreground` to the active item.

### P2-10 — `LeadFilters` requires submit; no debounce, no live search
**File:** [components/leads/LeadFilters.tsx](components/leads/LeadFilters.tsx)
**Fix:** Debounce text input via `useDeferredValue` + auto-submit on change; keep state in URL via `useSearchParams`.

### P2-11 — No way to delete a campaign or lead
**Files:** [app/api/campaigns/[id]/route.ts](app/api/campaigns/[id]/route.ts), [app/api/leads/[id]/route.ts](app/api/leads/[id]/route.ts)
**Fix:** Add DELETE endpoints (cascade via Prisma) plus a confirmation dialog (shadcn Dialog) on the UI side.

### P2-12 — Lead notes field exists in schema/API but no UI to edit
**Files:** [prisma/schema.prisma:94](prisma/schema.prisma#L94), [components/leads/LeadDetail.tsx](components/leads/LeadDetail.tsx)
**Fix:** Add a `<Textarea>` to `LeadDetail` that PATCHes `/api/leads/[id]` with `{ notes }`.

### P2-13 — Lead detail does not link to its campaign
**File:** [components/leads/LeadDetail.tsx](components/leads/LeadDetail.tsx)
**Fix:** Add a "Back to campaign" breadcrumb / link at the top.

### P2-14 — Lead detail does not show outreach status badge prominently
**File:** [components/leads/LeadDetail.tsx](components/leads/LeadDetail.tsx)
**Fix:** Add a status pill near the lead score; allow inline changes via PATCH (`outreachStatus`).

### P2-15 — `LeadsTable` overflows on mobile; no sticky first column
**File:** [components/leads/LeadsTable.tsx](components/leads/LeadsTable.tsx)
**Fix:** Make the company-name column sticky; collapse less-important columns into a tooltip on small screens.

### P2-16 — Source ID (`node/12345`) is not a link
**File:** [components/leads/LeadDetail.tsx](components/leads/LeadDetail.tsx)
**Fix:** Render as `<a href="https://www.openstreetmap.org/{type}/{id}" target="_blank">` so the user can verify.

### P2-17 — No copy-to-clipboard for emails/phones (core outreach workflow)
**Files:** [components/leads/LeadDetail.tsx](components/leads/LeadDetail.tsx), [components/leads/LeadsTable.tsx](components/leads/LeadsTable.tsx)
**Fix:** Add a small `<CopyButton value={…}/>` next to email/phone fields; show a brief check-icon on success.

### P2-18 — Outreach draft template/key not displayed
**File:** [components/leads/OutreachDraftCard.tsx](components/leads/OutreachDraftCard.tsx)
**Fix:** Show "Template: SEO improvement" with a select to switch templates and re-render.

### P2-19 — Outreach body has 5000-char API cap but no `maxLength` on textarea
**Files:** API + [components/leads/OutreachDraftCard.tsx](components/leads/OutreachDraftCard.tsx)
**Fix:** Add `maxLength={5000}` and a character counter.

### P2-20 — Dashboard stats not scoped by date / status, count entire history
**File:** [app/dashboard/page.tsx](app/dashboard/page.tsx)
**Fix:** Add "Last 7 / 30 days" toggle; scope counts to active (non-archived) campaigns once archiving lands (P4-3).

### P2-21 — `app/page.tsx` does an extra redirect via `/dashboard` → `/login`
**File:** [app/page.tsx](app/page.tsx)
**Fix:** Inspect the session at the root and redirect directly to `/login` or `/dashboard`.

### P2-22 — `requireAuth()` doesn't preserve `next` when redirecting to `/login`
**File:** [src/server/auth/session.ts](src/server/auth/session.ts)
**Fix:** `redirect(`/login?next=${encodeURIComponent(currentPath)}`)`.

### P2-23 — `processCollectOsmLeads` always overwrites status to `COLLECTED` last
**File:** [src/server/services/job.service.ts:311-313](src/server/services/job.service.ts#L311-L313)
(Same as P1-10 but specifically about ordering — fix together.)

### P2-24 — `next.config.ts` is empty; no `serverExternalPackages` for Prisma
**File:** [next.config.ts](next.config.ts)
**Fix:** Add `serverExternalPackages: ["@prisma/client"]` to avoid bundle warnings.

### P2-25 — `package.json` `build` script runs `prisma generate && next build` — fails on Vercel preview without DATABASE_URL
**File:** [package.json](package.json)
**Fix:** Either set `DATABASE_URL=postgres://x` in Vercel preview env (dummy) OR use `prisma generate --no-engine` and a `postinstall` step.

### P2-26 — No ESLint
**File:** [package.json](package.json)
**Fix:** Add `eslint`, `eslint-config-next`, basic `.eslintrc` and an `npm run lint` that actually lints (not just `tsc --noEmit`).

### P2-27 — `tsconfig` lacks `noUncheckedIndexedAccess`
**File:** [tsconfig.json](tsconfig.json)
**Problem:** Code has many `array[0]` accesses (`lead.audits[0]`, `outreachDrafts[0]`) typed as defined.
**Fix:** Enable the flag; fix the resulting errors (most are 1-line `?.` additions).

### P2-28 — Crawler sets `WEBSITE_PAGES.slice(0, 7)` even though list length is exactly 7
**File:** [src/server/services/crawler.service.ts](src/server/services/crawler.service.ts)
**Fix:** Drop the slice or move the 7-page cap to a named constant `MAX_PAGES_PER_BUSINESS` and use it.

### P2-29 — `safeFetchText` does not advertise `Accept-Encoding`; defends-in-depth
**File:** [src/server/utils/fetch-with-timeout.ts](src/server/utils/fetch-with-timeout.ts)
**Fix:** `Accept-Encoding: identity` to defang gzip/brotli amplification (the byte counter watches decoded bytes anyway, but smaller is safer).

### P2-30 — `/api/health` returns 200 even when env is misconfigured
**File:** [app/api/health/route.ts](app/api/health/route.ts)
**Fix:** Also assert presence of `DATABASE_URL`, `NEXTAUTH_SECRET`, `APP_USER_AGENT`. Return 503 when any is missing.

### P2-31 — `Campaign.lastError` and `Lead.lastError` can grow unbounded
**File:** [prisma/schema.prisma](prisma/schema.prisma)
**Fix:** Truncate to 1000 chars before write.

### P2-32 — Outreach template substitutions emit literal blank holes when variables are missing
**File:** [src/server/services/outreach-template.service.ts:182](src/server/services/outreach-template.service.ts#L182)
**Problem:** `Hi  team,` if `company_name` is null and the fallback "your business" wasn't applied.
**Fix:** Provide explicit fallbacks for every variable; collapse double whitespace at the end.

### P2-33 — `IMAGE_EXTENSIONS` blacklist in email extractor doesn't catch all CDN patterns
**File:** [src/server/services/email-extractor.service.ts](src/server/services/email-extractor.service.ts)
**Fix:** Add `.avif`, `.bmp`, `.ico`, `.tiff`, `.heic`. Also reject local-parts that look like cache-busting hashes (32+ hex chars).

### P2-34 — `cleanEmail` doesn't strip smart quotes / dashes
**File:** [src/server/services/email-extractor.service.ts:41-49](src/server/services/email-extractor.service.ts#L41-L49)
**Fix:** Add `‘ ’ “ ” – —` to the strip set.

### P2-35 — Geocode-cache lookup is exact match
**File:** [src/server/services/geocoding.service.ts](src/server/services/geocoding.service.ts)
**Problem:** "Mirpur, Dhaka" and "Mirpur Dhaka" are different cache keys despite being equivalent.
**Fix:** Normalise: lowercase, trim, collapse whitespace, strip diacritics, replace `,/;` with space before keying.

### P2-36 — `LeadsPage` empty-state does not differentiate "no leads in DB" vs "no leads matching filters"
**File:** [app/leads/page.tsx](app/leads/page.tsx)
**Fix:** Branch on whether any active filters are present and show distinct copy + "Clear filters" button.

### P2-37 — No `loading.tsx` skeleton on `/api/jobs/process` triggers
**Files:** UI side ([components/campaigns/CampaignStatusCard.tsx](components/campaigns/CampaignStatusCard.tsx))
**Fix:** Use `useTransition` to avoid blocking UI; show a sticky toast with a progress bar and allow cancelling the request.

### P2-38 — Footer attribution missing on `/login`
**File:** [app/layout.tsx](app/layout.tsx)
**Note:** verify the login page is wrapped by the root layout and footer is visible. If not, add it.

### P2-39 — `Sidebar` "Settings" page form has no client-side validation feedback before submit
**File:** [components/layout/SettingsForm.tsx](components/layout/SettingsForm.tsx)
**Fix:** Use `react-hook-form` + `@hookform/resolvers/zod` (already in package.json) like `CampaignForm` does.

### P2-40 — Confirmation modal not used for any potentially destructive action
**Files:** every action button
**Fix:** Once delete actions land (P2-11), gate behind shadcn `AlertDialog`.

---

## P3 — Low / Polish

### P3-1 — README missing instructions for `APP_USER_EMAIL`, cron secret in Vercel env, and clarification that "User" model is unused.
[README.md](README.md)

### P3-2 — README doesn't document why no email is sent (users will ask).
[README.md](README.md)

### P3-3 — `package.json` lacks `seed` and `format` scripts; add them.
[package.json](package.json)

### P3-4 — Login page styling: error message looks like body text; add an `Alert` variant.
[app/login/page.tsx](app/login/page.tsx)

### P3-5 — `components/ui/empty-state.tsx` always uses the `Search` icon; allow `icon` prop with sensible defaults per usage site.

### P3-6 — `LeadDetail` doesn't visually distinguish role accounts (`info@`) from personal accounts even though the extractor classifies them.
[components/leads/LeadDetail.tsx](components/leads/LeadDetail.tsx)

### P3-7 — `LeadsPage` columns are inconsistent widths; consider a fixed table layout (`table-layout: fixed`) plus tooltips on truncated cells.
[components/leads/LeadsTable.tsx](components/leads/LeadsTable.tsx)

### P3-8 — `LeadDetail` does not show "last enriched at"; only `audit.createdAt` indirectly.

### P3-9 — `BUSINESS_CATEGORIES` rendered in insertion order; sort alphabetically for predictability (or group by sector).
[src/shared/constants/categories.ts](src/shared/constants/categories.ts)

### P3-10 — `OSM_CATEGORY_KEYS` typed as `[string, ...string[]]`; type-narrow to `keyof typeof OSM_CATEGORIES`.

### P3-11 — `dynamic = "force-dynamic"` is applied broadly; revisit each route and remove where caching is fine.

### P3-12 — `verifyPassword` uses `scrypt N=16384`; bump to `N=131072 r=8 p=1` (still cheap on modern hardware).
[src/server/auth/password.ts](src/server/auth/password.ts)

### P3-13 — `errors.ts` defines `AppError` but is unused — either remove or actually throw it from API routes for consistent error JSON.
[src/server/utils/errors.ts](src/server/utils/errors.ts)

### P3-14 — Add a `lib/api-client.ts` shared fetch wrapper for client-side calls so error handling/toasts are consistent.

### P3-15 — Add automated tests
- Vitest + React Testing Library + a Postgres test container.
- Unit-test scoring rules, opportunity summary, robots parser, SSRF blocker, email cleaner.
- Integration-test job queue (lock/recover/complete).

### P3-16 — Migrate raw `@@unique` workaround comments to actual partial unique indexes (P1-27 / P0-6 covers two of these).

### P3-17 — Set `Lead.notes` `@db.Text` if not already, to avoid the default 191-char limit on some MySQL setups (Postgres is fine).

### P3-18 — Add `instrumentation.ts` for basic OpenTelemetry / `console` wrapping; persist important errors in the DB as the spec requested.

### P3-19 — Tailwind container max-width inconsistent across pages; define a `<PageShell maxWidth=...>` component.

### P3-20 — `verifyPassword` returns false on length mismatch before `timingSafeEqual` (length is fixed, so OK), but still better to compare-then-decide.

### P3-21 — `OutreachDraft.status` is a free-form string; convert to enum (`draft`, `approved`, `exported`, `archived`).

### P3-22 — README setup step "create initial user" is missing — clarify how to generate the bcrypt hash.

### P3-23 — `.gitignore` missing `*.tsbuildinfo` (large, currently committed).
[tsconfig.tsbuildinfo](tsconfig.tsbuildinfo)

---

## P4 — New Feature Suggestions (free / no-paid-API)

### P4-1 — Bulk lead actions
Select multiple leads in `LeadsTable` → bulk "Generate drafts", "Mark exported", "Mark not-interested", "Delete". Saves enormous time.

### P4-2 — Lead tags / labels
`tagsJson` already exists. Add a multi-select tag input on `LeadDetail` and a tag filter on `/leads`.

### P4-3 — Campaign archiving
Add `Campaign.status = ARCHIVED` so old campaigns drop off the dashboard but remain queryable.

### P4-4 — Cross-campaign duplicate detection
On lead creation, warn (don't block) if `normalizedDomain` exists in another campaign — useful to avoid contacting the same business twice.

### P4-5 — Email re-verification
Button on `LeadDetail` that re-runs MX/SPF check without re-crawling the website.

### P4-6 — JSON export and Excel (XLSX) export
Add `?format=json` and `?format=xlsx` to the export endpoint. SheetJS (Apache 2.0) is free.

### P4-7 — Copy-to-clipboard (P2-17 captured) plus quick-actions (`mailto:`, `tel:`, `Open in Maps`).

### P4-8 — Map view
Render leads on an OpenStreetMap tile layer using **Leaflet** (BSD-2). Filter the table by map bounds. Free, fits the OSM ethos.

### P4-9 — Domain blacklist
`BlockedDomain` table; future collections skip these. Useful to filter out chains, malls, agencies you've already worked with.

### P4-10 — Saved filters per page
Persist current `LeadFilters` state to `AppSetting` with a name; quick-switch presets.

### P4-11 — Replace phone regex with **libphonenumber-js** (MIT, free)
Better extraction, formatting, and country-aware validation.

### P4-12 — Photon (or Pelias) as a Nominatim fallback
Photon is OSM-based, AGPL self-hostable, free. Helps when Nominatim throttles.

### P4-13 — Use OSM `contact:*` tags more thoroughly
`contact:fax`, `contact:youtube`, `contact:tiktok`, `opening_hours`, `wheelchair`. Already partially done — extend.

### P4-14 — **Sitemap-first crawling**
Before guessing `/contact` etc., fetch `/sitemap.xml` (free) and look for paths matching `/contact|/about|/team`. Far more reliable than guessing.

### P4-15 — Domain age via DNS SOA serial (free, `dns/promises.resolveSoa`) — adds a "domain established" hint to the lead score.

### P4-16 — **crt.sh** (free Certificate Transparency search) for sub-domain discovery — useful before crawling to find the real marketing domain when OSM has the wrong one.

### P4-17 — Markdown preview pane for outreach drafts
Use `markdown-it` (MIT). Lets users format calls-to-action while keeping plain-text export.

### P4-18 — Rate-limit dashboard
Show current Nominatim/Overpass consumption windows on the Settings or Dashboard page so the user understands throttling.

### P4-19 — CSV import
CLI command (or upload form) to seed a campaign with `(name, location)` pairs. Lets the app act on existing prospect lists.

### P4-20 — Outreach status timeline
Track `OutreachDraft.status` transitions (`draft → approved → exported → contacted → replied`) with timestamps; show a tiny per-status funnel on the dashboard.

### P4-21 — "Test connection" buttons in Settings
Probe Nominatim & Overpass and show OK/Fail before launching a real campaign.

### P4-22 — Accessibility pass
- `:focus-visible` outlines (Tailwind already provides `ring`, just apply consistently).
- `prefers-reduced-motion` respected for spinners.
- aria-live region for `CampaignStatusCard` status messages.
- Tab order audit on `LeadFilters`.

### P4-23 — Soft "Undo" for last bulk action
After a bulk update, show a toast with "Undo (29s)". Implementable via an undo log table or in-memory.

### P4-24 — Dark mode toggle (after P2-8 lands)
`prefers-color-scheme` default with manual override stored in `AppSetting`.

### P4-25 — Per-domain crawl backoff persisted in DB
Currently the 2-second per-domain politeness is in-memory. Move to a `DomainPolicy` table so multiple workers / serverless instances share state.

---

## Quick wins to do first (suggested ordering)

1. **P0-9** security headers (10-min change, big risk reduction).
2. **P0-4** CSRF middleware (1-hour change, big risk reduction).
3. **P0-7 / P1-22** allow re-collection (1-2 hours, fixes a glaring usability bug).
4. **P1-14 / P1-15** CSV header & streaming (1-2 hours, blocks export users).
5. **P1-23** mobile menu (1 hour, makes the app usable on phones).
6. **P1-13** filter `rate_limit:*` from `/api/settings` (5-min PII fix).
7. **P0-1** subdomain redirect handling (recovers a large fraction of lost enrichments).
8. **P0-2 / P0-3** SSRF hardening (1 day; ship before any external user touches the app).
9. **P2-7** error/loading boundaries (UX polish).
10. **P1-12** wire up Settings to actually take effect.

After those, work through P1 in order; P2/P3/P4 can be picked off opportunistically.
