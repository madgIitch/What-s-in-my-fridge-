import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/receipt/errors";
import { canonicalPayload, parseConfirmPayload } from "@/lib/normalization/contracts";
import { isCivilDate } from "@/lib/inventory/dates";
import { productV3ApiEnabled, productV3Unavailable } from "../_guard";

export async function POST(request: Request) {
  if (!productV3ApiEnabled()) return productV3Unavailable();
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse("AUTH_REQUIRED", null);
  const clientCivilDate = request.headers.get("x-client-civil-date");
  if (!clientCivilDate || !isCivilDate(clientCivilDate)) return errorResponse("INVALID_REQUEST", null, "Necesitamos una fecha local válida");
  let payload; try { payload = parseConfirmPayload(await request.json()); } catch (error) {
    return errorResponse(error instanceof Error && error.message === "NO_ACCEPTED_LINES" ? "INVALID_REQUEST" : "INVALID_REQUEST", null, "Selecciona al menos una línea");
  }
  if (!payload.purchaseDate || payload.purchaseDate > clientCivilDate) return errorResponse("INVALID_REQUEST", null, "La fecha de compra no puede ser futura");
  const hash = createHash("sha256").update(canonicalPayload(payload)).digest("hex");
  const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("confirm_receipt_draft_v2", { p_draft_id: payload.draftId, p_normalizer_version: payload.normalizerVersion,
    p_lines: payload.lines, p_purchase_date: payload.purchaseDate ?? null, p_payload_hash: hash });
  if (error || !data) return errorResponse("DRAFT_STATE_CONFLICT", null);
  const result = data as { code?: string; itemIds?: string[]; pendingCount?: number };
  if (result.code === "DRAFT_NOT_FOUND") return errorResponse("DRAFT_NOT_FOUND", null);
  if (result.code) return errorResponse(result.code === "VALIDATION_ERROR" ? "INVALID_REQUEST" : "DRAFT_STATE_CONFLICT", null);
  return Response.json({ draftId: payload.draftId, status: "confirmed", itemIds: result.itemIds ?? [], pendingCount: result.pendingCount ?? 0 });
}
