import { prisma } from "@/src/server/db/prisma";
import { safeFetchText } from "@/src/server/utils/fetch-with-timeout";
import { waitWithDbSetting } from "@/src/server/utils/rate-limit";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name?: string;
};

export async function geocodeLocation(query: string) {
  const normalizedQuery = normalizeGeocodeQuery(query);
  const cached = await prisma.geocodeCache.findUnique({ where: { query: normalizedQuery } });
  if (cached) {
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      displayName: cached.displayName ?? query,
      cached: true
    };
  }

  await waitWithDbSetting("nominatim", 1000);
  const baseUrl = process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org";
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  const response = await safeFetchText(url.toString(), {
    timeoutMs: 10_000,
    maxBytes: 250_000,
    accept: "application/json",
    allowContentTypes: ["application/json", "text/json", "text/plain"],
    userAgent: process.env.APP_USER_AGENT ?? "OpenLeadScout/1.0 (local development; contact configurable via APP_USER_AGENT)",
    headers: {
      referer: process.env.APP_BASE_URL ?? "http://localhost:3000"
    },
    verifyPublicIp: true
  });

  if (response.status >= 400) {
    if (response.status === 403) {
      throw new Error("Nominatim rejected the request. Set a specific APP_USER_AGENT and APP_BASE_URL that identify this app.");
    }
    throw new Error(`Nominatim request failed with HTTP ${response.status}`);
  }

  const results = JSON.parse(response.text) as NominatimResult[];
  const first = results[0];
  if (!first) {
    throw new Error(`No geocoding result found for "${query}"`);
  }

  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Nominatim returned invalid coordinates");
  }

  await prisma.geocodeCache.create({
    data: {
      query: normalizedQuery,
      latitude,
      longitude,
      displayName: first.display_name,
      rawJson: first
    }
  });

  return {
    latitude,
    longitude,
    displayName: first.display_name ?? query,
    cached: false
  };
}

function normalizeGeocodeQuery(query: string) {
  return query
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[;,/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
