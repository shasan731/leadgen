import { z } from "zod";

const queryBoolean = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
);

export const leadQuerySchema = z.object({
  campaignId: z.string().optional(),
  search: z.string().optional(),
  emailStatus: z.string().optional(),
  enrichmentStatus: z.string().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  hasEmail: queryBoolean,
  hasWebsite: queryBoolean,
  hasPhone: queryBoolean,
  quality: z.enum(["Hot", "Good", "Medium", "Low"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const leadPatchSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
  outreachStatus: z
    .enum(["NOT_STARTED", "DRAFT_CREATED", "APPROVED", "EXPORTED", "CONTACTED", "REPLIED", "NOT_INTERESTED"])
    .optional()
});
