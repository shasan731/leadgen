import { normalizeDomain } from "./domain";

const BLOCKED_PROTOCOLS = new Set(["javascript:", "data:", "file:", "ftp:"]);

export function normalizeUrl(input?: string | null) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  if (BLOCKED_PROTOCOLS.has(url.protocol) || !["http:", "https:"].includes(url.protocol)) {
    return null;
  }
  url.hash = "";
  return url.toString();
}

export function sameRegistrableHost(a: string, b: string) {
  const hostA = normalizeDomain(new URL(a).hostname);
  const hostB = normalizeDomain(new URL(b).hostname);
  return Boolean(hostA && hostB && hostA === hostB);
}

export function cleanText(value?: string | null, maxLength = 500) {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}
