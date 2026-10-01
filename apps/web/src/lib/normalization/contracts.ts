import { isCivilDate } from "@/lib/inventory/dates";

export const NORMALIZER_VERSION = "receipt-normalizer-v2" as const;
export type PantryLocation = "fridge" | "pantry" | "freezer";
export type Candidate = { foodConceptId: string; slug: string; displayName: string };
export type ReviewLine = {
  lineId: string; rawName: string; rawText: string; displayName: string;
  resolution: "resolved" | "doubtful" | "unknown"; foodConceptId: string | null;
  candidates: Candidate[]; quantity: { precision: "unknown" | "exact"; quantity?: number; unit?: string };
  purchase: { acquiredOn: string | null; source: "receipt" | "user" };
  freshness: { precision: "unknown" | "estimated"; windowDays?: number; source?: "catalog" };
  suggestedLocation?: PantryLocation | null;
  version?: number; decision?: "accept" | "unknown" | "omit";
};

export type ConfirmDecision = {
  lineId: string; decision: "accept" | "unknown" | "omit";
  foodConceptId?: string; displayName?: string; location?: PantryLocation;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && uuid.test(value);

export function parseConfirmPayload(value: unknown): { draftId: string; normalizerVersion: string; lines: ConfirmDecision[]; purchaseDate?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_REQUEST");
  const body = value as Record<string, unknown>;
  if (["userId", "user_id", "owner", "ownerId"].some((key) => key in body)
    || !isUuid(body.draftId) || body.normalizerVersion !== NORMALIZER_VERSION || !Array.isArray(body.lines)) throw new Error("INVALID_REQUEST");
  const seen = new Set<string>();
  const lines = body.lines.map((entry): ConfirmDecision => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("INVALID_REQUEST");
    const line = entry as Record<string, unknown>;
    if (typeof line.lineId !== "string" || !line.lineId || seen.has(line.lineId)
      || !["accept", "unknown", "omit"].includes(String(line.decision))) throw new Error("INVALID_REQUEST");
    seen.add(line.lineId);
    if (line.displayName !== undefined && (typeof line.displayName !== "string" || line.displayName.trim().length < 1 || line.displayName.trim().length > 120)) throw new Error("INVALID_REQUEST");
    if (line.foodConceptId !== undefined && !isUuid(line.foodConceptId)) throw new Error("INVALID_REQUEST");
    if (line.location !== undefined && !["fridge", "pantry", "freezer"].includes(String(line.location))) throw new Error("INVALID_REQUEST");
    return line as ConfirmDecision;
  });
  if (!lines.some((line) => line.decision !== "omit")) throw new Error("NO_ACCEPTED_LINES");
  if (body.purchaseDate !== undefined && (typeof body.purchaseDate !== "string" || !isCivilDate(body.purchaseDate))) throw new Error("INVALID_REQUEST");
  return { draftId: body.draftId, normalizerVersion: body.normalizerVersion, lines, ...(body.purchaseDate ? { purchaseDate: body.purchaseDate as string } : {}) };
}

export function canonicalPayload(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalPayload).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalPayload(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
