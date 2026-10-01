import { createServerSupabaseClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/receipt/errors";
import { isCivilDate } from "@/lib/inventory/dates";
import { productV3ApiEnabled, productV3Unavailable } from "../_guard";

export async function POST(request: Request) {
  if (!productV3ApiEnabled()) return productV3Unavailable();
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return errorResponse("AUTH_REQUIRED", null);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return errorResponse("INVALID_REQUEST", null); }
  if (!['barcode','voice','manual'].includes(String(body.source)) || typeof body.value !== "string" || body.value.trim().length < 1 || body.value.trim().length > 120
    || typeof body.localDate !== "string" || !isCivilDate(body.localDate) || ["userId","user_id","owner"].some((key) => key in body)) return errorResponse("INVALID_REQUEST", null);
  const source = String(body.source); const value = body.value.trim(); if (source === "barcode" && !/^\d{6,18}$/.test(value)) return errorResponse("INVALID_REQUEST", null, "Revisa el código");
  let name = value; if (source === "barcode") { const { data } = await supabase.from("commercial_products").select("display_name").eq("barcode", value).maybeSingle(); if (data?.display_name) name = data.display_name; else if (typeof body.name !== "string" || !/[\p{L}\p{N}]/u.test(body.name) || body.name.trim().length > 120) return Response.json({ code: "BARCODE_NAME_REQUIRED", message: "Escribe el nombre del producto" }, { status: 422 }); else name = body.name.trim(); }
  const draftId = crypto.randomUUID(); const lineId = crypto.randomUUID(); const line = { lineId, rawText: value, name, quantity: null, unit: null, quantityExplicit: false, quantityEvidence: null, unitPrice: null, totalPrice: null, confidence: null, accepted: true, ...(source === "barcode" ? { barcode: value } : {}) };
  const draft = { merchant: null, purchaseDate: null, currency: null, total: null, items: [line], unrecognizedLines: [] };
  const { error } = await supabase.from("receipt_drafts").insert({ id: draftId, user_id: user.id, status: "review", raw_text: value, captured_at: new Date().toISOString(), parser_version: "manual-v1", ocr_result: draft, original_lines: [line], edited_lines: [line], lines: [line], unrecognized_lines: [] } as never);
  if (error) return errorResponse("DRAFT_STATE_CONFLICT", null);
  return Response.json({ draftId }, { status: 201 });
}
