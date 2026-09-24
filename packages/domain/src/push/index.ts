export const PUSH_CONTRACT = "push-v1" as const;
export const PUSH_TYPES = ["recipe-job-completed"] as const;
export type PushType = (typeof PUSH_TYPES)[number];

export interface PushPayload {
  version: typeof PUSH_CONTRACT;
  type: PushType;
  eventId: string;
  path: string;
}

const EVENT_ID = /^[A-Za-z0-9_-]{16,128}$/;
const ALLOWED_PATHS = [/^\/app$/, /^\/app\/recipes(?:\/import)?(?:\?[A-Za-z0-9._~%=&-]+)?$/];

export function normalizePushPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 512 || !value.startsWith("/app") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f]/.test(value)) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (decoded !== value && /(?:\.\.|[\\]|^\/\/|^[a-z][a-z0-9+.-]*:)/i.test(decoded)) return null;
  if (/(?:^|\/)\.\.(?:\/|$)/.test(decoded)) return null;
  let parsed: URL;
  try { parsed = new URL(value, "https://neverita.invalid"); } catch { return null; }
  if (parsed.origin !== "https://neverita.invalid" || parsed.username || parsed.password || parsed.hash) return null;
  const normalized = `${parsed.pathname}${parsed.search}`;
  return ALLOWED_PATHS.some((rule) => rule.test(normalized)) ? normalized : null;
}

export function parsePushPayload(value: unknown): PushPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).sort().join(",") !== "eventId,path,type,version") return null;
  const path = normalizePushPath(input.path);
  if (input.version !== PUSH_CONTRACT || !PUSH_TYPES.includes(input.type as PushType) || typeof input.eventId !== "string" || !EVENT_ID.test(input.eventId) || !path) return null;
  return { version: PUSH_CONTRACT, type: input.type as PushType, eventId: input.eventId, path };
}
