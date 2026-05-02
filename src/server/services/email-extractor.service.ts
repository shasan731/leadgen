import { BLOCKED_EMAIL_DOMAINS, BLOCKED_EMAILS, DISPOSABLE_EMAIL_DOMAINS, FREE_MAILBOX_DOMAINS } from "@/src/shared/constants/email-blacklist";
import { normalizeDomain } from "@/src/server/utils/domain";

export type ExtractedEmailCandidate = {
  email: string;
  sourceUrl?: string;
  domain: string;
  localPart: string;
  emailType: string;
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EMAIL_SYNTAX_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico", ".tiff", ".heic"];

export function extractEmailsFromText(text: string, sourceUrl?: string): ExtractedEmailCandidate[] {
  const decoded = decodeObfuscatedEmails(text);
  const matches = decoded.match(EMAIL_REGEX) ?? [];
  const seen = new Set<string>();
  const emails: ExtractedEmailCandidate[] = [];

  for (const match of matches) {
    const cleaned = cleanEmail(match);
    if (!cleaned || seen.has(cleaned) || isRejectedEmail(cleaned)) continue;
    const [localPart, domainRaw] = cleaned.split("@");
    const domain = normalizeDomain(domainRaw);
    if (!domain || !localPart) continue;
    seen.add(cleaned);
    emails.push({
      email: cleaned,
      sourceUrl,
      domain,
      localPart,
      emailType: classifyEmail(localPart, domain)
    });
  }

  return emails;
}

export function cleanEmail(value: string) {
  const email = value
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/[),.;:\]"'>‘’“”–—]+$/g, "")
    .replace(/^[([.;:\]"'<‘’“”–—]+/g, "")
    .trim();
  return EMAIL_SYNTAX_REGEX.test(email) ? email : null;
}

export function decodeObfuscatedEmails(text: string) {
  if (!/\[\s*at\s*]|\(\s*at\s*\)/i.test(text)) return text;
  return text
    .replace(/\s*\[\s*at\s*]\s*/gi, "@")
    .replace(/\s*\(\s*at\s*\)\s*/gi, "@")
    .replace(/\s*\[\s*dot\s*]\s*/gi, ".")
    .replace(/\s*\(\s*dot\s*\)\s*/gi, ".");
}

export function isRejectedEmail(email: string) {
  if (BLOCKED_EMAILS.has(email)) return true;
  if (email.startsWith("noreply@") || email.startsWith("no-reply@")) return true;
  const [, domain] = email.split("@");
  const [localPart] = email.split("@");
  if (!domain || !domain.includes(".")) return true;
  if (/^[a-f0-9]{32,}$/i.test(localPart ?? "")) return true;
  if (IMAGE_EXTENSIONS.some((extension) => domain.endsWith(extension))) return true;
  if (BLOCKED_EMAIL_DOMAINS.some((blocked) => domain.endsWith(blocked))) return true;
  return false;
}

export function classifyEmail(localPart: string, domain: string) {
  if (["sales", "business", "commercial"].includes(localPart)) return "role_sales";
  if (["info", "hello"].includes(localPart)) return "role_info";
  if (["support", "help", "service"].includes(localPart)) return "role_support";
  if (["contact", "enquiry", "inquiry"].includes(localPart)) return "role_contact";
  if (["booking", "bookings", "reservation", "reservations"].includes(localPart)) return "role_booking";
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return "risky";
  if (/^[a-z]+[._-]?[a-z]*$/.test(localPart) && localPart.length >= 3) return "personal";
  return "other";
}

export function pickBestEmail(candidates: ExtractedEmailCandidate[], websiteDomain?: string | null) {
  if (!candidates.length) return null;
  const businessDomain = normalizeDomain(websiteDomain);
  const sorted = [...candidates].sort((a, b) => scoreEmail(b, businessDomain) - scoreEmail(a, businessDomain));
  return sorted[0];
}

function scoreEmail(candidate: ExtractedEmailCandidate, websiteDomain?: string | null) {
  let score = 0;
  if (websiteDomain && candidate.domain === websiteDomain) score += 100;
  if (candidate.sourceUrl?.includes("contact")) score += 30;
  if (["role_info", "role_contact", "role_sales", "role_booking", "role_support"].includes(candidate.emailType)) score += 20;
  if (candidate.emailType === "personal") score += 10;
  if (FREE_MAILBOX_DOMAINS.has(candidate.domain) && websiteDomain && candidate.domain !== websiteDomain) score -= 20;
  if (candidate.emailType === "risky") score -= 50;
  return score;
}
