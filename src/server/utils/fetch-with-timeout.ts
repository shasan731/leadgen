import { Agent, request } from "undici";
import { resolvePublicAddresses } from "./domain";

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  accept?: string;
  allowContentTypes?: string[];
  method?: "GET" | "POST";
  body?: BodyInit;
  headers?: Record<string, string>;
  verifyPublicIp?: boolean;
};

export type SafeFetchResult = {
  url: string;
  status: number;
  contentType: string;
  text: string;
  bytes: number;
  elapsedMs: number;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

export async function safeFetchText(urlInput: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  let url = new URL(urlInput);
  assertFetchableUrl(url);

  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 1_000_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  let method = options.method ?? "GET";
  let body = options.body as unknown;

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      const dispatcher = options.verifyPublicIp === false ? undefined : await createPinnedDispatcher(url.hostname);
      const response = await request(url.toString(), {
        method,
        body,
        dispatcher,
        signal: controller.signal,
        headers: {
          "user-agent": options.userAgent ?? process.env.APP_USER_AGENT ?? "OpenLeadScout/1.0",
          accept: options.accept ?? "text/html,text/plain;q=0.9,*/*;q=0.1",
          "accept-encoding": "identity",
          ...options.headers
        }
      } as Parameters<typeof request>[1]);

      if (REDIRECT_STATUSES.has(response.statusCode)) {
        const location = firstHeader(response.headers.location);
        if (!location) {
          return readTextResponse(response, url.toString(), maxBytes, started, options.allowContentTypes);
        }
        if (redirectCount === MAX_REDIRECTS) {
          throw new Error("Too many redirects");
        }
        url = new URL(location, url);
        assertFetchableUrl(url);
        if ([301, 302, 303].includes(response.statusCode)) {
          method = "GET";
          body = undefined;
        }
        continue;
      }

      return readTextResponse(response, url.toString(), maxBytes, started, options.allowContentTypes);
    }
    throw new Error("Too many redirects");
  } finally {
    clearTimeout(timeout);
  }
}

async function createPinnedDispatcher(hostname: string) {
  const addresses = await resolvePublicAddresses(hostname);
  const first = addresses[0];
  if (!first) throw new Error("Hostname did not resolve");
  return new Agent({
    connect: {
      lookup: (_hostname, _options, callback) => {
        callback(null, first.address, first.family);
      }
    }
  });
}

async function readTextResponse(
  response: Awaited<ReturnType<typeof request>>,
  finalUrl: string,
  maxBytes: number,
  started: number,
  allowContentTypes?: string[]
): Promise<SafeFetchResult> {
  const contentType = firstHeader(response.headers["content-type"]) ?? "";
  const allowed = allowContentTypes ?? ["text/html", "text/plain"];
  if (contentType && !allowed.some((type) => contentType.toLowerCase().includes(type))) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      throw new Error("Response exceeded maximum allowed size");
    }
    chunks.push(buffer);
  }

  return {
    url: finalUrl,
    status: response.statusCode,
    contentType,
    text: Buffer.concat(chunks).toString("utf8"),
    bytes: total,
    elapsedMs: Date.now() - started
  };
}

function assertFetchableUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    throw new Error("Blocked localhost URL");
  }
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
