import { z } from "zod";
import { OSM_CATEGORY_KEYS } from "@/src/shared/constants/osm-tags";

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  businessType: z.string().trim().min(2).max(100),
  osmCategoryKey: z.enum(OSM_CATEGORY_KEYS as [string, ...string[]]),
  locationQuery: z.string().trim().min(2).max(200),
  radiusMeters: z.coerce.number().int().min(500).max(20000),
  maxLeads: z.coerce.number().int().min(1).max(200),
  serviceOffer: z.string().trim().max(120).optional().nullable(),
  senderName: z.string().trim().max(100).optional().nullable(),
  senderCompany: z.string().trim().max(100).optional().nullable(),
  senderService: z.string().trim().max(200).optional().nullable()
});

export const campaignPatchSchema = campaignCreateSchema.partial();

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
