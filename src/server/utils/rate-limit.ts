import { prisma } from "@/src/server/db/prisma";

const memoryLocks = new Map<string, number>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitInMemory(key: string, minDelayMs: number) {
  const now = Date.now();
  const nextAllowed = memoryLocks.get(key) ?? 0;
  if (nextAllowed > now) {
    await sleep(nextAllowed - now);
  }
  memoryLocks.set(key, Date.now() + minDelayMs);
}

export async function waitWithDbSetting(key: string, minDelayMs: number) {
  const settingKey = `rate_limit:${key}`;
  const setting = await prisma.rateLimit.findUnique({ where: { key: settingKey } });
  const now = Date.now();
  const previous = setting?.value ? Number(setting.value) : 0;
  const waitMs = Number.isFinite(previous) ? Math.max(0, previous + minDelayMs - now) : 0;
  if (waitMs > 0) {
    await sleep(waitMs);
  }
  await prisma.rateLimit.upsert({
    where: { key: settingKey },
    update: { value: String(Date.now()) },
    create: { key: settingKey, value: String(Date.now()) }
  });
}
