export function generateOpportunitySummary(issues: string[], serviceOffer?: string | null) {
  const service = (serviceOffer ?? "").toLowerCase();

  if (issues.includes("no_website")) {
    return "This business has a public local listing but no website was found. Good fit for a basic website, Google-ready business profile, and local SEO setup.";
  }

  if (issues.includes("no_email_found")) {
    return "The website exists, but no public email address was found. Good fit for contact-page improvement and lead capture setup.";
  }

  const seoIssues = ["missing_meta_description", "weak_meta_description", "weak_title", "no_schema_markup"];
  if (seoIssues.some((issue) => issues.includes(issue)) || service.includes("seo")) {
    return "The website appears to have weak SEO basics: missing or short metadata, weak page signals, or no structured data detected. Good fit for local SEO improvement.";
  }

  if (issues.includes("no_contact_form")) {
    return "The website has no visible contact form. Good fit for conversion and inquiry form setup.";
  }

  if (issues.includes("slow_response")) {
    return "The website response appears slow. Good fit for performance optimization.";
  }

  return "This lead has public business details and enough contact context for a careful, manually reviewed local outreach workflow.";
}
