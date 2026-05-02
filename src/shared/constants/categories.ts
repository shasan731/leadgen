import { OSM_CATEGORIES } from "./osm-tags";

export const BUSINESS_CATEGORIES = Object.values(OSM_CATEGORIES).map((category) => ({
  value: category.key,
  label: category.label
})).sort((a, b) => a.label.localeCompare(b.label));

export const SERVICE_OFFERS = [
  { value: "website_creation", label: "Website creation" },
  { value: "seo_improvement", label: "SEO improvement" },
  { value: "contact_page_improvement", label: "Contact page improvement" },
  { value: "performance_optimization", label: "Performance optimization" },
  { value: "digital_marketing", label: "Digital marketing" },
  { value: "software_solution", label: "Software solution" },
  { value: "generic_local_business", label: "Generic local business service" }
] as const;
