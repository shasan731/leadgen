import { resolve4, resolve6, resolveMx } from "node:dns/promises";
import { EmailStatus } from "@prisma/client";
import { DISPOSABLE_EMAIL_DOMAINS } from "@/src/shared/constants/email-blacklist";
import { isRejectedEmail } from "./email-extractor.service";

const EMAIL_SYNTAX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export type EmailValidationResult = {
  status: EmailStatus;
  hasMx: boolean;
  domain: string | null;
};

export async function validateEmail(email?: string | null, domainCache?: Map<string, EmailValidationResult>): Promise<EmailValidationResult> {
  if (!email || !EMAIL_SYNTAX.test(email) || isRejectedEmail(email)) {
    return { status: EmailStatus.INVALID_FORMAT, hasMx: false, domain: null };
  }
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return { status: EmailStatus.INVALID_FORMAT, hasMx: false, domain: null };
  const cached = domainCache?.get(domain);
  if (cached) return { ...cached, domain };
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    const result = { status: EmailStatus.DISPOSABLE, hasMx: false, domain };
    domainCache?.set(domain, result);
    return result;
  }

  try {
    const mx = await resolveMx(domain);
    if (mx.length > 0) {
      const result = { status: EmailStatus.MX_FOUND, hasMx: true, domain };
      domainCache?.set(domain, result);
      return result;
    }
  } catch {
    // Fall through to A/AAAA lookup.
  }

  try {
    const [a, aaaa] = await Promise.allSettled([resolve4(domain), resolve6(domain)]);
    const hasAddress =
      (a.status === "fulfilled" && a.value.length > 0) || (aaaa.status === "fulfilled" && aaaa.value.length > 0);
    const result = { status: hasAddress ? EmailStatus.RISKY : EmailStatus.NO_MX, hasMx: false, domain };
    domainCache?.set(domain, result);
    return result;
  } catch {
    const result = { status: EmailStatus.NO_MX, hasMx: false, domain };
    domainCache?.set(domain, result);
    return result;
  }
}
