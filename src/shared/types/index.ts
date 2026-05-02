export type Issue = {
  key: string;
  label: string;
  severity: "low" | "medium" | "high";
};

export type SocialLinks = {
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  youtubeUrl?: string;
  twitterUrl?: string;
  socialUrl?: string;
};

export type CsvLeadRow = {
  campaign_name: string;
  company_name: string;
  category: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  email_status: string;
  lead_score: number;
  lead_quality: string;
  opportunity_summary: string;
  outreach_subject: string;
  outreach_body: string;
  outreach_status: string;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
  contact_page_url: string;
  website_issues: string;
  created_at: string;
};
