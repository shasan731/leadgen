import { OSM_CATEGORIES, type OsmCategoryKey } from "@/src/shared/constants/osm-tags";
import { safeFetchText } from "@/src/server/utils/fetch-with-timeout";
import { waitInMemory } from "@/src/server/utils/rate-limit";

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements: OverpassElement[];
};

export async function queryOverpassBusinesses(input: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  osmCategoryKey: string;
  maxLeads: number;
}) {
  const radius = clamp(input.radiusMeters, 500, 20000);
  const maxLeads = clamp(input.maxLeads, 1, 200);
  const category = OSM_CATEGORIES[input.osmCategoryKey as OsmCategoryKey];
  if (!category) {
    throw new Error(`Unsupported OSM category: ${input.osmCategoryKey}`);
  }

  const query = buildOverpassQuery({
    latitude: input.latitude,
    longitude: input.longitude,
    radiusMeters: radius,
    maxLeads,
    osmCategoryKey: input.osmCategoryKey
  });

  await waitInMemory("overpass", 1000);
  const baseUrl = process.env.OVERPASS_BASE_URL ?? "https://overpass-api.de/api/interpreter";

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await safeFetchText(baseUrl, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
      timeoutMs: 30_000,
      maxBytes: 2_000_000,
      accept: "application/json",
      allowContentTypes: ["application/json", "text/json", "text/plain"],
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      userAgent: process.env.APP_USER_AGENT,
      verifyPublicIp: true
    });

    if (response.status === 429) {
      lastError = new Error("Overpass rate limited the request");
      await delay(1000 * (attempt + 1) * 2);
      continue;
    }
    if (response.status === 504) {
      throw new Error("Overpass timed out. Try a smaller radius or max lead count.");
    }
    if (response.status >= 400) {
      throw new Error(`Overpass request failed with HTTP ${response.status}`);
    }

    const data = JSON.parse(response.text) as OverpassResponse;
    return data.elements.slice(0, maxLeads);
  }

  throw lastError ?? new Error("Overpass request failed");
}

export function buildOverpassQuery(input: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  osmCategoryKey: string;
  maxLeads: number;
}) {
  const category = OSM_CATEGORIES[input.osmCategoryKey as OsmCategoryKey];
  if (!category) throw new Error(`Unsupported OSM category: ${input.osmCategoryKey}`);

  const clauses = category.tags
    .flatMap((tag) => {
      const value = tag.value === "*" ? `["${tag.key}"]` : `["${tag.key}"="${tag.value}"]`;
      return [
        `node${value}(around:${input.radiusMeters},${input.latitude},${input.longitude});`,
        `way${value}(around:${input.radiusMeters},${input.latitude},${input.longitude});`,
        `relation${value}(around:${input.radiusMeters},${input.latitude},${input.longitude});`
      ];
    })
    .join("\n  ");

  return `[out:json][timeout:25];
(
  ${clauses}
);
out center tags ${input.maxLeads};`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
