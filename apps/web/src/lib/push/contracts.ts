export const PUSH_CONTRACT = "push-v1" as const;
export type PushPayload = { version: typeof PUSH_CONTRACT; type: "recipe-job-completed"; eventId: string; path: string };
const EVENT_ID = /^[A-Za-z0-9_-]{16,128}$/;
const ALLOWED_PATHS = [/^\/app$/, /^\/app\/recipes$/, /^\/app\/recipes\/import(?:\?job=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/];

export function normalizePushPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512 || !value.startsWith("/app") || value.startsWith("//") || /[%\\\u0000-\u001f]/.test(value)) return null;
  let decoded: string; try { decoded = decodeURIComponent(value); } catch { return null; }
  if (decoded !== value && /(?:\.\.|[\\]|^\/\/|^[a-z][a-z0-9+.-]*:)/i.test(decoded)) return null;
  if (/(?:^|\/)\.\.(?:\/|$)/.test(decoded)) return null;
  let parsed: URL; try { parsed = new URL(value, "https://neverita.invalid"); } catch { return null; }
  if (parsed.origin !== "https://neverita.invalid" || parsed.username || parsed.password || parsed.hash) return null;
  const normalized = `${parsed.pathname}${parsed.search}`;
  return ALLOWED_PATHS.some((rule) => rule.test(normalized)) ? normalized : null;
}

export function parsePushPayload(value: unknown): PushPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>; const path = normalizePushPath(input.path);
  if (Object.keys(input).sort().join(",") !== "eventId,path,type,version" || input.version !== PUSH_CONTRACT || input.type !== "recipe-job-completed" || typeof input.eventId !== "string" || !EVENT_ID.test(input.eventId) || !path) return null;
  return { version: PUSH_CONTRACT, type: "recipe-job-completed", eventId: input.eventId, path };
}

export type BrowserSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function canonicalEndpoint(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length < 12 || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    url.hostname = url.hostname.toLowerCase();
    if (url.port === "443") url.port = "";
    return url.toString();
  } catch { return null; }
}

export function parseSubscriptionBody(value: unknown): BrowserSubscription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const outer = value as Record<string, unknown>;
  if (Object.keys(outer).some((key) => key !== "subscription") || !outer.subscription || typeof outer.subscription !== "object" || Array.isArray(outer.subscription)) return null;
  const sub = outer.subscription as Record<string, unknown>;
  if (Object.keys(sub).some((key) => !["endpoint", "expirationTime", "keys"].includes(key)) || !sub.keys || typeof sub.keys !== "object" || Array.isArray(sub.keys)) return null;
  const keys = sub.keys as Record<string, unknown>;
  const endpoint = canonicalEndpoint(sub.endpoint);
  if (!endpoint || Object.keys(keys).sort().join(",") !== "auth,p256dh" || typeof keys.p256dh !== "string" || typeof keys.auth !== "string" || !BASE64URL.test(keys.p256dh) || !BASE64URL.test(keys.auth) || keys.p256dh.length > 256 || keys.auth.length > 128) return null;
  if (sub.expirationTime !== null && sub.expirationTime !== undefined && (typeof sub.expirationTime !== "number" || !Number.isSafeInteger(sub.expirationTime))) return null;
  return { endpoint, expirationTime: sub.expirationTime as number | null ?? null, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export function parseUnsubscribeBody(value: unknown): { endpoint: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== "endpoint")) return null;
  const endpoint = canonicalEndpoint(input.endpoint);
  return endpoint ? { endpoint } : null;
}

export function makePushPayload(eventId: string, path: string): PushPayload | null {
  return parsePushPayload({ version: PUSH_CONTRACT, type: "recipe-job-completed", eventId, path });
}
