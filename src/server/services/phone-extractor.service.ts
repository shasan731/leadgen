import { findPhoneNumbersInText } from "libphonenumber-js";

const ANCHORED_PHONE_REGEX =
  /(?:phone|tel|call|mobile|whatsapp|cell|hotline)[:\s-]*(\+?\d[\d\s().-]{6,}\d)/gi;

export function extractPhonesFromText(text: string) {
  const phones = new Set<string>();

  for (const match of findPhoneNumbersInText(text)) {
    if (match.number.isValid()) {
      phones.add(match.number.formatInternational());
    }
  }

  for (const match of text.matchAll(ANCHORED_PHONE_REGEX)) {
    const cleaned = cleanPhone(match[1]);
    if (!cleaned) continue;
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 16) phones.add(cleaned);
  }

  return [...phones];
}

export function cleanPhone(value?: string | null) {
  if (!value) return null;
  const cleaned = value.replace(/^tel:/i, "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

export function pickBestPhone(phones: string[]) {
  return phones.find((phone) => phone.startsWith("+")) ?? phones[0] ?? null;
}
