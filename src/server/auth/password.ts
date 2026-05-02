import crypto from "node:crypto";
import { timingSafeEqual } from "node:crypto";

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const n = 131072;
  const r = 8;
  const p = 1;
  const key = crypto.scryptSync(password, salt, 64, { N: n, r, p }).toString("hex");
  return `scrypt:${n}:${r}:${p}:${salt}:${key}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, n, r, p, salt, expected] = storedHash.split(":");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !expected) {
    return false;
  }
  const actual = crypto
    .scryptSync(password, salt, Buffer.from(expected, "hex").length, {
      N: Number(n),
      r: Number(r),
      p: Number(p)
    })
    .toString("hex");
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
