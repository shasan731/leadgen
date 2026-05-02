import * as cheerio from "cheerio";
import { EmailStatus, EnrichmentStatus, WebsiteStatus } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import { WEBSITE_PAGES } from "@/src/shared/constants/website-pages";
import { safeFetchText } from "@/src/server/utils/fetch-with-timeout";
import { hostnameFromUrl, normalizeDomain, sameRegistrableDomain } from "@/src/server/utils/domain";
import { normalizeUrl, cleanText } from "@/src/server/utils/normalize-url";
import { waitInMemory } from "@/src/server/utils/rate-limit";
import { extractEmailsFromText, pickBestEmail, type ExtractedEmailCandidate } from "./email-extractor.service";
import { extractPhonesFromText, pickBestPhone } from "./phone-extractor.service";
import { extractSocialLinks } from "./social-extractor.service";
import { validateEmail } from "./email-validation.service";
import { isAllowedByRobots } from "./robots.service";

const MAX_PAGES_PER_BUSINESS = 7;

type PageResult = {
  url: string;
  finalUrl: string;
  status: number;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  hasContactForm: boolean;
  hasSchema: boolean;
  hasViewportMeta: boolean;
  emails: ExtractedEmailCandidate[];
  phones: string[];
  hrefs: string[];
  loadTimeMs: number;
};

export async function crawlLeadWebsite(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead not found");

  const inputWebsite = lead.website?.trim() ?? "";
  const hadProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(inputWebsite);
  const normalized = normalizeUrl(lead.website);
  if (!normalized) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        websiteStatus: WebsiteStatus.NO_WEBSITE,
        enrichmentStatus: EnrichmentStatus.SKIPPED,
        issuesJson: [{ key: "no_website", label: "No website found", severity: "high" }]
      }
    });
    return;
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { website: normalized, normalizedDomain: normalizeDomain(hostnameFromUrl(normalized)), enrichmentStatus: EnrichmentStatus.PROCESSING }
  });

  let origin = new URL(normalized).origin;
  const fallbackOrigin = !hadProtocol && origin.startsWith("https://") ? origin.replace(/^https:\/\//, "http://") : null;
  const domain = normalizeDomain(new URL(normalized).hostname);
  const results: PageResult[] = [];
  const allEmails: ExtractedEmailCandidate[] = [];
  const allPhones = new Set<string>();
  const allHrefs: string[] = [];
  const seenFinalUrls = new Set<string>();
  let contactPageUrl: string | null = null;
  let blockedByRobots = true;
  let redirectedAwayUrl: string | null = null;

  for (const path of WEBSITE_PAGES.slice(0, MAX_PAGES_PER_BUSINESS)) {
    let pageUrl = new URL(path, origin).toString();
    await waitInMemory(`crawl:${domain}`, 2000);
    const allowed = await isAllowedByRobots(pageUrl);
    if (!allowed) continue;
    blockedByRobots = false;

    try {
      const result = await fetchAndParsePage(pageUrl);
      if (!sameRegistrableDomain(result.finalUrl, normalized)) {
        redirectedAwayUrl = result.finalUrl;
        continue;
      }
      if (seenFinalUrls.has(normalizeUrl(result.finalUrl) ?? result.finalUrl)) continue;
      seenFinalUrls.add(normalizeUrl(result.finalUrl) ?? result.finalUrl);
      results.push(result);
      if (pageUrl.includes("contact") && result.status < 400) contactPageUrl = result.finalUrl;
      for (const email of result.emails) allEmails.push(email);
      for (const phone of result.phones) allPhones.add(phone);
      allHrefs.push(...result.hrefs);

      const hasEnoughData = allEmails.length > 0 && Boolean(contactPageUrl);
      if (hasEnoughData && results.some((page) => new URL(page.url).pathname === "/")) break;
    } catch {
      if (!fallbackOrigin) {
        if (pageUrl.includes("contact")) contactPageUrl = null;
        continue;
      }
      try {
        pageUrl = new URL(path, fallbackOrigin).toString();
        await waitInMemory(`crawl:${domain}`, 2000);
        const allowedFallback = await isAllowedByRobots(pageUrl);
        if (!allowedFallback) continue;
        const result = await fetchAndParsePage(pageUrl);
        if (!sameRegistrableDomain(result.finalUrl, normalized)) {
          redirectedAwayUrl = result.finalUrl;
          continue;
        }
        if (seenFinalUrls.has(normalizeUrl(result.finalUrl) ?? result.finalUrl)) continue;
        seenFinalUrls.add(normalizeUrl(result.finalUrl) ?? result.finalUrl);
        origin = fallbackOrigin;
        results.push(result);
        if (pageUrl.includes("contact") && result.status < 400) contactPageUrl = result.finalUrl;
        for (const email of result.emails) allEmails.push(email);
        for (const phone of result.phones) allPhones.add(phone);
        allHrefs.push(...result.hrefs);
      } catch {
        if (pageUrl.includes("contact")) contactPageUrl = null;
      }
    }
  }

  if (blockedByRobots) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        websiteStatus: WebsiteStatus.BLOCKED_BY_ROBOTS,
        enrichmentStatus: EnrichmentStatus.SKIPPED,
        lastError: "Blocked by robots.txt",
        issuesJson: [{ key: "website_unreachable", label: "Website blocked crawling by robots.txt", severity: "medium" }]
      }
    });
    return;
  }

  if (!results.length && redirectedAwayUrl) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        websiteStatus: WebsiteStatus.REDIRECTED_AWAY,
        enrichmentStatus: EnrichmentStatus.SKIPPED,
        lastError: `Website redirected off domain to ${redirectedAwayUrl}`.slice(0, 1000),
        issuesJson: [{ key: "redirected_off_domain", label: "Website redirected to another domain", severity: "medium", url: redirectedAwayUrl }]
      }
    });
    return;
  }

  const homepage = results.find((page) => new URL(page.url).pathname === "/") ?? results[0];
  const socialLinks = extractSocialLinks(allHrefs, normalized);
  if (lead.email) {
    const [localPart, emailDomain] = lead.email.toLowerCase().split("@");
    if (localPart && emailDomain) {
      allEmails.push({ email: lead.email.toLowerCase(), sourceUrl: "openstreetmap", domain: emailDomain, localPart, emailType: "osm" });
    }
  }
  const emailCandidates = dedupeEmails(allEmails);
  const bestEmail = pickBestEmail(emailCandidates, domain);
  const bestPhone = lead.phone ?? pickBestPhone([...allPhones]);
  let emailStatus: EmailStatus = lead.emailStatus;
  const validationCache = new Map<string, Awaited<ReturnType<typeof validateEmail>>>();

  if (bestEmail) {
    const validation = await validateEmail(bestEmail.email, validationCache);
    emailStatus = validation.status;
    await Promise.all(
      emailCandidates.map(async (candidate) => {
      const candidateValidation = candidate.email === bestEmail.email ? validation : await validateEmail(candidate.email, validationCache);
      await prisma.extractedEmail.upsert({
        where: { leadId_email: { leadId, email: candidate.email } },
        update: {
          sourceUrl: candidate.sourceUrl,
          domain: candidate.domain,
          localPart: candidate.localPart,
          emailType: candidate.emailType,
          hasMx: candidateValidation.hasMx,
          status: candidateValidation.status
        },
        create: {
          leadId,
          email: candidate.email,
          sourceUrl: candidate.sourceUrl,
          domain: candidate.domain,
          localPart: candidate.localPart,
          emailType: candidate.emailType,
          hasMx: candidateValidation.hasMx,
          status: candidateValidation.status
        }
      });
      })
    );
  } else if (lead.email) {
    const validation = await validateEmail(lead.email, validationCache);
    emailStatus = validation.status;
  }

  const issues = buildWebsiteIssues({
    website: normalized,
    homepage,
    contactPageUrl,
    emailFound: Boolean(bestEmail ?? lead.email),
    phoneFound: Boolean(bestPhone),
    socialFound: Boolean(socialLinks.socialUrl),
    contactFormFound: results.some((page) => page.hasContactForm),
    anyContactPageFailed: WEBSITE_PAGES.some((url) => url.includes("contact")) && !contactPageUrl,
    redirectedAwayUrl
  });

  await prisma.$transaction([
    prisma.websiteAudit.deleteMany({ where: { leadId } }),
    prisma.websiteAudit.create({
      data: {
        leadId,
        url: homepage?.finalUrl ?? normalized,
        httpStatus: homepage?.status,
        hasHttps: (homepage?.finalUrl ?? normalized).startsWith("https://"),
        title: homepage?.title,
        metaDescription: homepage?.metaDescription,
        h1: homepage?.h1,
        hasContactForm: results.some((page) => page.hasContactForm),
        hasEmail: Boolean(bestEmail ?? lead.email),
        hasPhone: Boolean(bestPhone),
        hasFacebook: Boolean(socialLinks.facebookUrl),
        hasInstagram: Boolean(socialLinks.instagramUrl),
        hasLinkedin: Boolean(socialLinks.linkedinUrl),
        hasSchema: results.some((page) => page.hasSchema),
        hasViewportMeta: Boolean(homepage?.hasViewportMeta),
        loadTimeMs: homepage?.loadTimeMs,
        pagesCrawled: results.length,
        issuesJson: issues
      }
    })
  ]);

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      website: homepage?.finalUrl ?? normalized,
      normalizedDomain: normalizeDomain(hostnameFromUrl(homepage?.finalUrl ?? normalized)),
      phone: bestPhone,
      email: bestEmail?.email ?? lead.email,
      emailStatus,
      contactPageUrl,
      facebookUrl: socialLinks.facebookUrl,
      instagramUrl: socialLinks.instagramUrl,
      linkedinUrl: socialLinks.linkedinUrl,
      youtubeUrl: socialLinks.youtubeUrl,
      twitterUrl: socialLinks.twitterUrl,
      socialUrl: socialLinks.socialUrl,
      websiteStatus: WebsiteStatus.CRAWLED,
      enrichmentStatus: EnrichmentStatus.FINISHED,
      issuesJson: issues,
      lastError: null
    }
  });
}

async function fetchAndParsePage(url: string): Promise<PageResult> {
  const response = await safeFetchText(url, {
    timeoutMs: 10_000,
    maxBytes: 1_000_000,
    accept: "text/html,*/*;q=0.1",
    allowContentTypes: ["text/html", "text/plain"],
    userAgent: process.env.APP_USER_AGENT
  });
  const $ = cheerio.load(response.text);
  $("script, style, noscript, svg").remove();
  const text = $("body").text();
  const hrefs = $("a[href]")
    .map((_, element) => $(element).attr("href") ?? "")
    .get()
    .filter(Boolean);
  const mailtoText = $("a[href^='mailto:']")
    .map((_, element) => $(element).attr("href") ?? "")
    .get()
    .join(" ");
  const telText = $("a[href^='tel:']")
    .map((_, element) => $(element).attr("href") ?? "")
    .get()
    .join(" ");
  const jsonLd = $("script[type='application/ld+json']").text();
  const emails = extractEmailsFromText(`${text} ${mailtoText} ${jsonLd}`, response.url).slice(0, 20);
  const phones = extractPhonesFromText(`${text} ${telText}`);

  return {
    url,
    finalUrl: response.url,
    status: response.status,
    title: cleanText($("title").first().text(), 160),
    metaDescription: cleanText($("meta[name='description']").attr("content"), 300),
    h1: cleanText($("h1").first().text(), 180),
    hasContactForm: $("form").length > 0 && ($("input[type='email']").length > 0 || $("textarea").length > 0),
    hasSchema: $("script[type='application/ld+json']").length > 0,
    hasViewportMeta: $("meta[name='viewport']").length > 0,
    emails,
    phones,
    hrefs,
    loadTimeMs: response.elapsedMs
  };
}

function dedupeEmails(emails: ExtractedEmailCandidate[]) {
  const seen = new Set<string>();
  return emails.filter((candidate) => {
    if (seen.has(candidate.email)) return false;
    seen.add(candidate.email);
    return true;
  });
}

function buildWebsiteIssues(input: {
  website: string;
  homepage?: PageResult;
  contactPageUrl?: string | null;
  emailFound: boolean;
  phoneFound: boolean;
  socialFound: boolean;
  contactFormFound: boolean;
  anyContactPageFailed: boolean;
  redirectedAwayUrl?: string | null;
}) {
  const issues: Array<{ key: string; label: string; severity: "low" | "medium" | "high" }> = [];
  const title = input.homepage?.title ?? "";
  const meta = input.homepage?.metaDescription ?? "";
  if (!input.website) issues.push({ key: "no_website", label: "No website found", severity: "high" });
  if (!input.homepage || input.homepage.status >= 400) issues.push({ key: "website_unreachable", label: "Website unreachable", severity: "high" });
  if (!input.website.startsWith("https://") && !input.homepage?.finalUrl.startsWith("https://")) issues.push({ key: "no_https", label: "HTTPS not detected", severity: "medium" });
  if (!title) issues.push({ key: "missing_title", label: "Missing page title", severity: "medium" });
  if (title && (title.length < 10 || /\bhome\b/i.test(title))) issues.push({ key: "weak_title", label: "Weak page title", severity: "low" });
  if (!meta) issues.push({ key: "missing_meta_description", label: "Missing meta description", severity: "medium" });
  if (meta && meta.length < 50) issues.push({ key: "weak_meta_description", label: "Weak meta description", severity: "low" });
  if (!input.homepage?.h1) issues.push({ key: "missing_h1", label: "Missing H1", severity: "low" });
  if (!input.contactPageUrl) issues.push({ key: "no_contact_page_found", label: "No contact page found", severity: "medium" });
  if (!input.emailFound) issues.push({ key: "no_email_found", label: "No public email found", severity: "medium" });
  if (!input.phoneFound) issues.push({ key: "no_phone_found", label: "No public phone found", severity: "medium" });
  if (!input.contactFormFound) issues.push({ key: "no_contact_form", label: "No contact form detected", severity: "low" });
  if (!input.socialFound) issues.push({ key: "no_social_links", label: "No social links detected", severity: "low" });
  if (!input.homepage?.hasSchema) issues.push({ key: "no_schema_markup", label: "No schema markup detected", severity: "low" });
  if (!input.homepage?.hasViewportMeta) issues.push({ key: "no_viewport_meta", label: "No viewport meta tag detected", severity: "medium" });
  if ((input.homepage?.loadTimeMs ?? 0) > 2500) issues.push({ key: "slow_response", label: "Slow response", severity: "medium" });
  if (input.anyContactPageFailed) issues.push({ key: "broken_contact_page", label: "Contact page may be broken", severity: "low" });
  if (input.redirectedAwayUrl) issues.push({ key: "redirected_off_domain", label: "Website redirected to another domain", severity: "medium" });
  return issues;
}
