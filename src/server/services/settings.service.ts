import { prisma } from "@/src/server/db/prisma";

export type EditableSettings = {
  senderName?: string;
  senderCompany?: string;
  senderService?: string;
  userAgentContactEmail?: string;
  defaultBatchSize?: string;
  defaultRadius?: string;
  attributionText?: string;
};

const EDITABLE_SETTING_KEYS = [
  "senderName",
  "senderCompany",
  "senderService",
  "userAgentContactEmail",
  "defaultBatchSize",
  "defaultRadius",
  "attributionText"
] as const;

export async function getEditableSettings(): Promise<EditableSettings> {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: [...EDITABLE_SETTING_KEYS] } }
  });
  return Object.fromEntries(settings.map((setting) => [setting.key, setting.value])) as EditableSettings;
}

export function defaultBatchSize(settings: EditableSettings) {
  const parsed = Number(settings.defaultBatchSize);
  return Number.isInteger(parsed) ? Math.min(10, Math.max(1, parsed)) : 5;
}

export function defaultRadius(settings: EditableSettings) {
  const parsed = Number(settings.defaultRadius);
  return Number.isInteger(parsed) ? Math.min(20000, Math.max(500, parsed)) : 5000;
}
