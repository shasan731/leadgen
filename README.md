# OpenLead Scout

OpenLead Scout is a deterministic, rule-based Next.js app for finding local business leads from free/public resources. It uses OpenStreetMap data, public business websites, DNS checks, Prisma, and PostgreSQL. It does not use AI, paid scraping APIs, LinkedIn scraping, email sending, browser automation, Redis, or paid background workers.

## Stack

- Next.js App Router on Vercel Hobby
- TypeScript
- Prisma ORM
- PostgreSQL via Neon
- Tailwind CSS with shadcn-style UI primitives
- Zod validation
- Cheerio HTML parsing
- Node `dns/promises` for MX checks
- Postgres-backed job queue

## Local Setup

1. `npm install`
2. `cp .env.example .env`
3. Add `DATABASE_URL`
4. Set `SESSION_SECRET`, `APP_USER_EMAIL`, and `APP_USER_AGENT`
5. Generate a password hash with `npm run hash-password` and set `APP_USER_PASSWORD_HASH`
6. `npx prisma generate`
7. `npx prisma migrate dev`
8. `npm run dev`

Open `http://localhost:3000` and sign in with `APP_USER_EMAIL` and the password used to create the hash. Authentication is single-user and environment-based; there is no `User` table in the database.

## Production Setup

1. Create a Neon project
2. Copy the pooled `DATABASE_URL`
3. Add environment variables to Vercel
4. Deploy from GitHub
5. Run Prisma migration with `npx prisma migrate deploy`
6. Set `APP_USER_AGENT` with a real contact email, for example `OpenLeadScout/1.0 you@example.com`
7. Test `/api/health`

Required production environment variables include `DATABASE_URL`, `DIRECT_DATABASE_URL`, `SESSION_SECRET`, `APP_USER_EMAIL`, `APP_USER_PASSWORD_HASH`, `APP_USER_AGENT`, `APP_BASE_URL`, and `CRON_SECRET`.

## Vercel Cron

`vercel.json` includes a daily cron:

```json
{
  "crons": [
    {
      "path": "/api/jobs/process-daily",
      "schedule": "0 2 * * *"
    }
  ]
}
```

The route requires `CRON_SECRET` via the `Authorization: Bearer ...` or `x-cron-secret` header, and processes at most 5 pending jobs.

## Public Data Sources

- Nominatim is used only for geocoding and results are cached in `GeocodeCache`.
- Overpass API is used for small OSM POI queries.
- Public business websites are fetched server-side with timeout, response-size, content-type, robots.txt, and SSRF guards.

The UI shows the required attribution: `Data from OpenStreetMap contributors.`

## Job Flow

Campaigns are processed manually in small batches:

1. Create campaign
2. Collect leads, which queues/geocodes/queries Overpass
3. Process enrichment batches, up to 5 website leads at a time
4. Score leads
5. Generate deterministic outreach drafts
6. Export CSV

The queue lives in Postgres in the `Job` table. Jobs move through `PENDING`, `PROCESSING`, `COMPLETED`, and `FAILED`, with stale lock recovery and exponential retry delays.

## Safety Notes

- No raw HTML is stored.
- Crawling is shallow: max 7 pages per business.
- Each page fetch has a 10-second timeout and 1 MB response limit.
- The crawler rejects localhost, private networks, link-local IPs, and common metadata endpoints.
- DNS validation checks syntax, disposable domains, MX records, and A/AAAA fallback only. It does not probe SMTP mailboxes.
- Outreach drafts are editable text only. The app does not send email.

## Why Email Is Not Sent

OpenLead Scout intentionally does not integrate Gmail, SMTP, or bulk sending. It only prepares deterministic drafts for manual review and CSV export. This avoids accidental spam, keeps the app inside the no-paid-services charter, and lets the user verify each lead before any outreach happens.
