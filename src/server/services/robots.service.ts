import { LRUCache } from "lru-cache";
import robotsParser from "robots-parser";
import { safeFetchText } from "@/src/server/utils/fetch-with-timeout";

const robotsCache = new LRUCache<string, string>({
  max: 500,
  ttl: 1000 * 60 * 60 * 24
});

export async function isAllowedByRobots(url: string) {
  const parsed = new URL(url);
  const origin = parsed.origin;
  let robots = robotsCache.get(origin);
  if (robots === undefined) {
    robots = (await fetchRobots(origin)) ?? "";
    robotsCache.set(origin, robots);
  }
  if (!robots) return true;
  const parser = robotsParser(`${origin}/robots.txt`, robots);
  return parser.isAllowed(url, process.env.APP_USER_AGENT ?? "OpenLeadScout") !== false;
}

async function fetchRobots(origin: string) {
  try {
    const response = await safeFetchText(`${origin}/robots.txt`, {
      timeoutMs: 5000,
      maxBytes: 100_000,
      accept: "text/plain,*/*;q=0.1",
      allowContentTypes: ["text/plain", "text/html"],
      userAgent: process.env.APP_USER_AGENT
    });
    if (response.status >= 400) return null;
    return response.text;
  } catch {
    return null;
  }
}
