export const SOURCE_TYPES = ["youtube", "instagram", "tiktok", "blog", "manual", "file"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export type JobState = "queued" | "fetching" | "transcribing" | "extracting" | "validating" | "completed" | "failed" | "cancelled";
export type CreateJobInput = { idempotencyKey: string; sourceUrl?: string; text?: string; uploadObject?: string; originalFilename?: string };

export function detectUrlType(raw: string): Exclude<SourceType, "manual" | "file"> {
  const url = new URL(raw); const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  return "blog";
}

export function validateCreateInput(value: unknown): { input: CreateJobInput; sourceType: SourceType } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((k) => !["idempotencyKey", "sourceUrl", "text", "uploadObject", "originalFilename"].includes(k))) return null;
  if (typeof v.idempotencyKey !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(v.idempotencyKey)) return null;
  const sourceUrl = typeof v.sourceUrl === "string" ? v.sourceUrl.trim() : undefined;
  const text = typeof v.text === "string" ? v.text.trim() : undefined;
  const uploadObject = typeof v.uploadObject === "string" ? v.uploadObject : undefined;
  if ([!!sourceUrl, !!text, !!uploadObject].filter(Boolean).length !== 1 || (text && text.length > 50_000)) return null;
  try {
    const sourceType = uploadObject ? "file" : sourceUrl ? detectUrlType(sourceUrl) : "manual";
    return { input: { idempotencyKey: v.idempotencyKey, sourceUrl, text, uploadObject, originalFilename: typeof v.originalFilename === "string" ? v.originalFilename.slice(0, 255) : undefined }, sourceType };
  } catch { return null; }
}

export function jobError(code: string, message: string, status = 400, retryable = false) {
  return Response.json({ contract: "recipe-import-error-v1", error: { code, message, retryable } }, { status, headers: { "Cache-Control": "no-store" } });
}
