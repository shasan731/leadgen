import type { Campaign, Lead } from "@prisma/client";
import type { EditableSettings } from "./settings.service";
import { normalizeIssueKeys } from "./lead-scoring.service";

type Template = {
  subject: string;
  body: string;
};

const TEMPLATES: Record<string, Template> = {
  website_creation: {
    subject: "Website improvement idea for {{company_name}}",
    body: `Hi {{company_name}} team,

I found your business while checking {{category}} services in {{location}}.

I noticed a few improvement opportunities:
- {{issue_1}}
- {{issue_2}}
- {{issue_3}}

We help local businesses improve their website, SEO, and online lead capture.

Regards,
{{sender_name}}
{{sender_company}}`
  },
  seo_improvement: {
    subject: "Local SEO idea for {{company_name}}",
    body: `Hi {{company_name}} team,

I found {{company_name}} while researching local {{category}} businesses in {{location}}.

A few SEO basics may be worth improving:
- {{issue_1}}
- {{issue_2}}
- {{issue_3}}

We help local businesses make their websites easier to find and easier to contact.

Regards,
{{sender_name}}
{{sender_company}}`
  },
  contact_page_improvement: {
    subject: "Contact page improvement for {{company_name}}",
    body: `Hi {{company_name}} team,

I came across your business while checking {{category}} options in {{location}}.

I noticed:
- {{issue_1}}
- {{issue_2}}
- {{issue_3}}

We help local businesses turn website visits into inquiries with clearer contact paths.

Regards,
{{sender_name}}
{{sender_company}}`
  },
  performance_optimization: {
    subject: "Website performance note for {{company_name}}",
    body: `Hi {{company_name}} team,

I found your website while reviewing {{category}} businesses in {{location}}.

There may be a few quick wins:
- {{issue_1}}
- {{issue_2}}
- {{issue_3}}

We help improve website speed, reliability, and inquiry conversion.

Regards,
{{sender_name}}
{{sender_company}}`
  },
  digital_marketing: {
    subject: "Local growth idea for {{company_name}}",
    body: `Hi {{company_name}} team,

I found your business while checking local {{category}} listings in {{location}}.

Some online presence improvements stood out:
- {{issue_1}}
- {{issue_2}}
- {{issue_3}}

We help local businesses improve visibility, trust, and inbound inquiries.

Regards,
{{sender_name}}
{{sender_company}}`
  },
  software_solution: {
    subject: "Simple software workflow idea for {{company_name}}",
    body: `Hi {{company_name}} team,

I found {{company_name}} while looking through {{category}} businesses in {{location}}.

Based on public info, a few operational improvements may be useful:
- {{issue_1}}
- {{issue_2}}
- {{issue_3}}

We help local businesses simplify online inquiries and customer workflows.

Regards,
{{sender_name}}
{{sender_company}}`
  },
  generic_local_business: {
    subject: "Quick online presence idea for {{company_name}}",
    body: `Hi {{company_name}} team,

I found your business while reviewing {{category}} services in {{location}}.

A few public-facing improvements may help:
- {{issue_1}}
- {{issue_2}}
- {{issue_3}}

We help local businesses improve their website, SEO, and customer inquiry flow.

Regards,
{{sender_name}}
{{sender_company}}`
  }
};

const DEFAULT_TEMPLATE: Template = TEMPLATES.generic_local_business ?? {
  subject: "Quick online presence idea for {{company_name}}",
  body: "Hi {{company_name}} team,\n\nI found your business while reviewing {{category}} services in {{location}}.\n\nRegards,\n{{sender_name}}\n{{sender_company}}"
};

const ISSUE_COPY: Record<string, string> = {
  no_website: "No public website was found",
  website_unreachable: "The website could not be reached reliably",
  no_https: "The site does not appear to use HTTPS",
  missing_title: "The homepage title appears to be missing",
  weak_title: "The homepage title appears weak or generic",
  missing_meta_description: "The meta description appears to be missing",
  weak_meta_description: "The meta description appears short",
  missing_h1: "The page has no clear H1 heading",
  no_contact_page_found: "No clear contact page was found",
  no_email_found: "No public email address was visible",
  no_phone_found: "No phone number was visible on the website",
  no_contact_form: "No visible contact form was detected",
  no_social_links: "No useful social profile link was detected",
  no_schema_markup: "No structured business data was detected",
  no_viewport_meta: "The page may be missing mobile viewport metadata",
  slow_response: "The homepage response looked slow",
  broken_contact_page: "A contact page URL looked broken"
};

export function generateOutreachDraft(lead: Lead, campaign: Campaign, settings: EditableSettings = {}) {
  const templateKey = campaign.serviceOffer || "generic_local_business";
  const template = TEMPLATES[templateKey] ?? DEFAULT_TEMPLATE;
  const issueKeys = normalizeIssueKeys(lead.issuesJson);
  const issueLabels = issueKeys.map((key) => ISSUE_COPY[key] ?? key.replace(/_/g, " "));
  const fallbackIssues = [
    "Public listing could be made easier to convert into inquiries",
    "Online business details could be clearer for local customers",
    "Website and contact signals could be strengthened"
  ];

  const variables: Record<string, string> = {
    company_name: lead.companyName ?? "your business",
    category: lead.category ?? campaign.businessType,
    location: campaign.locationQuery,
    issue_1: issueLabels[0] ?? fallbackIssues[0] ?? "Online presence could be clearer",
    issue_2: issueLabels[1] ?? fallbackIssues[1] ?? "Contact paths could be easier to find",
    issue_3: issueLabels[2] ?? fallbackIssues[2] ?? "Local search signals could be stronger",
    sender_name: campaign.senderName ?? settings.senderName ?? "Your name",
    sender_company: campaign.senderCompany ?? settings.senderCompany ?? "Your company",
    sender_service: campaign.senderService ?? settings.senderService ?? campaign.serviceOffer ?? "website and SEO services"
  };

  return {
    subject: cleanupCopy(replaceVariables(template.subject, variables)),
    body: cleanupCopy(replaceVariables(template.body, variables)),
    templateKey
  };
}

function replaceVariables(input: string, variables: Record<string, string>) {
  return input.replace(/\{\{(\w+)}}/g, (_, key: string) => variables[key] ?? "");
}

function cleanupCopy(input: string) {
  return input.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
