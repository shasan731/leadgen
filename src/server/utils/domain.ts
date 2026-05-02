import { lookup } from "node:dns/promises";
import net from "node:net";
import { getDomain } from "tldts";

export function hostnameFromUrl(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function normalizeDomain(hostname?: string | null) {
  if (!hostname) return null;
  return hostname.toLowerCase().trim().replace(/^www\./, "");
}

export function registrableDomain(hostnameOrUrl?: string | null) {
  if (!hostnameOrUrl) return null;
  let hostname = hostnameOrUrl;
  try {
    hostname = new URL(hostnameOrUrl).hostname;
  } catch {
    // Treat the input as a hostname.
  }
  const normalized = normalizeDomain(hostname);
  if (!normalized) return null;
  return getDomain(normalized, { allowPrivateDomains: true }) ?? normalized;
}

export function sameRegistrableDomain(a: string, b: string) {
  const domainA = registrableDomain(a);
  const domainB = registrableDomain(b);
  return Boolean(domainA && domainB && domainA === domainB);
}

export async function resolvePublicAddresses(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: false });
  if (!records.length) {
    throw new Error("Hostname did not resolve");
  }
  for (const record of records) {
    if (!isPublicIp(record.address)) {
      throw new Error(`Blocked private or reserved IP address: ${record.address}`);
    }
  }
  return records.map((record) => ({ address: record.address, family: record.family }));
}

export function isPublicIp(ip: string) {
  if (ip === "localhost") return false;
  const version = net.isIP(ip);
  if (version === 4) return isPublicIpv4(ip);
  if (version === 6) return isPublicIpv6(ip);
  return false;
}

function isPublicIpv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a = 0, b = 0] = parts;
  if (a === 0) return false;
  if (a === 10) return false;
  if (a === 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  const mapped = parseIpv4MappedIpv6(normalized);
  if (mapped) return isPublicIpv4(mapped);
  const bytes = ipv6ToBytes(normalized);
  if (!bytes) return false;

  if (bytes.every((byte) => byte === 0)) return false;
  if (normalized === "::1") return false;
  const b0 = bytes[0] ?? 0;
  const b1 = bytes[1] ?? 0;
  if (b0 === 0xff) return false; // multicast ff00::/8
  if ((b0 & 0xfe) === 0xfc) return false; // fc00::/7
  if (b0 === 0xfe && (b1 & 0xc0) === 0x80) return false; // fe80::/10
  if (bytes[0] === 0x10 && bytes.slice(1, 8).every((byte) => byte === 0)) return false; // 100::/64 discard
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) return false; // Teredo 2001::/32
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return false; // 6to4 2002::/16
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    bytes.slice(4, 12).every((byte) => byte === 0)
  ) {
    return false; // NAT64 64:ff9b::/96
  }
  return true;
}

function parseIpv4MappedIpv6(ip: string) {
  const match = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  return match?.[1] ?? null;
}

function ipv6ToBytes(ip: string) {
  const zoneFree = ip.split("%")[0];
  if (!zoneFree) return null;
  const [headRaw, tailRaw] = zoneFree.split("::");
  const head = headRaw ? headRaw.split(":").filter(Boolean) : [];
  const tail = tailRaw ? tailRaw.split(":").filter(Boolean) : [];
  if (zoneFree.includes("::")) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    return wordsToBytes([...head, ...Array.from({ length: missing }, () => "0"), ...tail]);
  }
  return wordsToBytes(head);
}

function wordsToBytes(words: string[]) {
  if (words.length !== 8) return null;
  const bytes: number[] = [];
  for (const word of words) {
    const value = Number.parseInt(word, 16);
    if (!Number.isFinite(value) || value < 0 || value > 0xffff) return null;
    bytes.push((value >> 8) & 0xff, value & 0xff);
  }
  return bytes;
}
