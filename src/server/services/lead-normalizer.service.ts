import type { Prisma } from "@prisma/client";
import { OSM_CATEGORIES, type OsmCategoryKey } from "@/src/shared/constants/osm-tags";
import { hostnameFromUrl, normalizeDomain } from "@/src/server/utils/domain";
import { normalizeUrl } from "@/src/server/utils/normalize-url";
import type { OverpassElement } from "./overpass.service";

export type NormalizedLead = Omit<Prisma.LeadCreateManyInput, "campaignId"> & {
  dedupeKey: string;
};

export function normalizeOverpassElements(elements: OverpassElement[], osmCategoryKey: string): NormalizedLead[] {
  const category = OSM_CATEGORIES[osmCategoryKey as OsmCategoryKey];
  const seen = new Set<string>();
  const normalized: NormalizedLead[] = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    const website = normalizeUrl(tags.website ?? tags["contact:website"] ?? tags.url);
    const normalizedDomain = website ? normalizeDomain(hostnameFromUrl(website)) : null;
    const phone = tags.phone ?? tags["contact:phone"] ?? tags.mobile ?? null;
    const email = tags.email ?? tags["contact:email"] ?? null;
    const companyName = tags.name ?? tags.brand ?? tags.operator ?? null;
    const address = buildAddress(tags);
    const latitude = element.lat ?? element.center?.lat ?? null;
    const longitude = element.lon ?? element.center?.lon ?? null;
    const sourceId = `${element.type}/${element.id}`;
    const categoryLabel = category?.label ?? osmCategoryKey;

    const dedupeKey =
      normalizedDomain ||
      normalizeLoose(phone) ||
      `${normalizeLoose(companyName)}:${normalizeLoose(address)}` ||
      sourceId;

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const facebookUrl = normalizeUrl(tags.facebook ?? tags["contact:facebook"]);
    const instagramUrl = normalizeUrl(tags.instagram ?? tags["contact:instagram"]);
    const linkedinUrl = normalizeUrl(tags.linkedin ?? tags["contact:linkedin"]);

    normalized.push({
      sourceId,
      sourceType: element.type,
      companyName,
      category: categoryLabel,
      address,
      latitude,
      longitude,
      phone,
      website,
      normalizedDomain,
      email,
      facebookUrl,
      instagramUrl,
      linkedinUrl,
      socialUrl: facebookUrl ?? instagramUrl ?? linkedinUrl,
      rawOsmTags: tags,
      tagsJson: { osmCategoryKey },
      dedupeKey
    });
  }

  return normalized;
}

function buildAddress(tags: Record<string, string>) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
    tags["addr:country"]
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : tags.address ?? tags["contact:address"] ?? null;
}

function normalizeLoose(input?: string | null) {
  return input?.toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}
