import type { SocialLinks } from "@/src/shared/types";

const PLATFORM_PATTERNS = {
  facebookUrl: /facebook\.com|fb\.com/i,
  instagramUrl: /instagram\.com/i,
  linkedinUrl: /linkedin\.com\/(company|school|showcase|in)\//i,
  youtubeUrl: /youtube\.com|youtu\.be/i,
  twitterUrl: /twitter\.com|x\.com/i
} as const;

const IGNORE_PATTERNS = /\/share|\/sharer|\/login|\/intent|\/privacy|\/help|\/plugins/i;

export function extractSocialLinks(hrefs: string[], baseUrl: string): SocialLinks {
  const links: SocialLinks = {};

  for (const href of hrefs) {
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const parsed = new URL(absolute);
    if (!["http:", "https:"].includes(parsed.protocol)) continue;
    if (IGNORE_PATTERNS.test(absolute)) continue;
    for (const [key, pattern] of Object.entries(PLATFORM_PATTERNS)) {
      const typedKey = key as keyof SocialLinks;
      if (!links[typedKey] && pattern.test(absolute)) {
        links[typedKey] = absolute;
      }
    }
  }

  links.socialUrl = links.facebookUrl ?? links.instagramUrl ?? links.linkedinUrl ?? links.youtubeUrl ?? links.twitterUrl;
  return links;
}
