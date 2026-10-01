import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/receipt/errors";
import { canonicalPayload, isUuid } from "@/lib/normalization/contracts";
import { productV3ApiEnabled, productV3Unavailable } from "../../../../_guard";

export async function PATCH(request: Request, context: { params: Promise<{ draftId: string; lineId: string }> }) {
  if (!productV3ApiEnabled()) return productV3Unavailable();
  const { draftId, lineId } = await context.params;
  const supabase = await createServerSupabaseClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse("AUTH_REQUIRED", null);
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return errorResponse("INVALID_REQUEST", null); }
  if (!isUuid(draftId) || !lineId || !isUuid(body.clientMutationId) || !Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 1
    || !["resolve", "omit"].includes(String(body.decision)) || ["userId", "user_id", "owner"].some((key) => key in body)
    || (body.foodConceptId !== undefined && body.foodConceptId !== null && !isUuid(body.foodConceptId))
    || (body.displayName !== undefined && (typeof body.displayName !== "string" || body.displayName.trim().length < 1 || body.displayName.trim().length > 120))) return errorResponse("INVALID_REQUEST", null);
  const hash = createHash("sha256").update(canonicalPayload({ draftId, lineId, ...body })).digest("hex");
  const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc("resolve_receipt_line_v2", { p_draft_id: draftId, p_line_id: lineId,
    p_client_mutation_id: body.clientMutationId, p_expected_version: body.expectedVersion, p_decision: body.decision,
    p_food_concept_id: body.foodConceptId ?? null, p_display_name: body.displayName ?? "Desconocido", p_request_hash: hash });
  if (error || !data) return errorResponse("DRAFT_STATE_CONFLICT", null);
  const result = data as { code?: string; item?: unknown };
  if (result.code === "SYNC_CONFLICT") return Response.json({ code: "SYNC_CONFLICT", item: result.item ?? null }, { status: 409 });
  if (result.code !== "OK") return errorResponse(result.code === "FORBIDDEN" ? "DRAFT_NOT_FOUND" : "INVALID_REQUEST", null);
  return Response.json(result);
}
