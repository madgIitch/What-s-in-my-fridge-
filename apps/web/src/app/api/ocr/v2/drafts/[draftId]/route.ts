import { createServerSupabaseClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/receipt/errors";
import { isUuid } from "@/lib/normalization/contracts";
import { productV3ApiEnabled, productV3Unavailable } from "../../_guard";

export async function GET(_request: Request, context: { params: Promise<{ draftId: string }> }) {
  if (!productV3ApiEnabled()) return productV3Unavailable();
  const { draftId } = await context.params;
  if (!isUuid(draftId)) return errorResponse("INVALID_REQUEST", null);
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse("AUTH_REQUIRED", null);
  const { data, error } = await supabase.from("receipt_drafts").select("*").eq("id", draftId).eq("user_id", user.id).maybeSingle();
  if (error || !data) return errorResponse("DRAFT_NOT_FOUND", null);
  const draft = data as unknown as { normalizer_version: string | null; normalization_review: unknown; review_decisions: unknown; status: string; purchase_date: string | null };
  if (!draft.normalizer_version || !Array.isArray(draft.normalization_review)) return errorResponse("DRAFT_STATE_CONFLICT", null);
  const { data: pendingData } = await supabase.from("inventory_items").select("*").eq("user_id", user.id).eq("receipt_draft_id" as never, draftId).eq("normalization_status" as never, "unknown").is("deleted_at", null);
  const pendingItems = (pendingData ?? []) as unknown as { id: string; receipt_line_id: string; version: number; name: string }[];
  const review = draft.normalization_review as { lineId: string; displayName: string }[];
  const lines = pendingItems.map((item) => ({ ...review.find((line) => line.lineId === item.receipt_line_id), lineId: item.receipt_line_id, displayName: item.name, itemId: item.id, version: Number(item.version) }));
  return Response.json({ draftId, normalizerVersion: draft.normalizer_version, status: draft.status,
    purchaseDate: draft.purchase_date, lines: draft.status === "confirmed" ? lines : draft.normalization_review, decisions: draft.review_decisions });
}

export async function PATCH(request: Request, context: { params: Promise<{ draftId: string }> }) {
  if (!productV3ApiEnabled()) return productV3Unavailable(); const { draftId } = await context.params; if (!isUuid(draftId)) return errorResponse("INVALID_REQUEST", null);
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return errorResponse("AUTH_REQUIRED", null);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return errorResponse("INVALID_REQUEST", null); }
  if (!Array.isArray(body.decisions) || body.decisions.length > 500 || ["userId","user_id","owner"].some((key) => key in body)) return errorResponse("INVALID_REQUEST", null);
  const { data: draft } = await supabase.from("receipt_drafts").select("original_lines,status").eq("id", draftId).eq("user_id", user.id).maybeSingle();
  if (!draft || draft.status !== "review" || !Array.isArray(draft.original_lines)) return errorResponse("DRAFT_STATE_CONFLICT", null);
  const ids = new Set((draft.original_lines as { lineId?: unknown }[]).map((line) => line.lineId).filter((id): id is string => typeof id === "string")); const seen = new Set<string>();
  for (const value of body.decisions) { if (!value || typeof value !== "object" || Array.isArray(value)) return errorResponse("INVALID_REQUEST", null); const decision = value as Record<string, unknown>;
    if (typeof decision.lineId !== "string" || !ids.has(decision.lineId) || seen.has(decision.lineId) || !["accept","unknown","omit"].includes(String(decision.decision))
      || (decision.foodConceptId !== undefined && !isUuid(decision.foodConceptId)) || (decision.displayName !== undefined && (typeof decision.displayName !== "string" || decision.displayName.trim().length < 1 || decision.displayName.trim().length > 120))) return errorResponse("INVALID_REQUEST", null); seen.add(decision.lineId); }
  const { error } = await supabase.from("receipt_drafts").update({ review_decisions: body.decisions } as never).eq("id", draftId).eq("user_id", user.id).eq("status", "review");
  if (error) return errorResponse("DRAFT_STATE_CONFLICT", null); return Response.json({ draftId, decisions: body.decisions });
}
