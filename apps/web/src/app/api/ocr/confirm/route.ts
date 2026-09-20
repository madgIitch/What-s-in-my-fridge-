import { createServerSupabaseClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/receipt/errors";
import { validateConfirmLines } from "@/lib/receipt/parser";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient(); const { data:{user} } = await supabase.auth.getUser();
  if (!user) return errorResponse("AUTH_REQUIRED", null);
  let payload: Record<string, unknown>; try { payload = await request.json(); } catch { return errorResponse("INVALID_REQUEST", null); }
  if (["userId","user_id","owner","ownerId"].some((key) => key in payload) || typeof payload.draftId !== "string" || !uuid.test(payload.draftId)) return errorResponse("INVALID_REQUEST", null);
  let lines; try { lines = validateConfirmLines(payload.lines); } catch { return errorResponse("INVALID_REQUEST", null, "Revisa las líneas aceptadas"); }
  const { data, error } = await supabase.rpc("confirm_receipt_draft", { p_draft_id:payload.draftId, p_lines:lines });
  if (error || !data) return errorResponse("DRAFT_STATE_CONFLICT", null);
  const result = data as { code?:string; itemIds?:string[] };
  if (result.code === "DRAFT_NOT_FOUND") return errorResponse("DRAFT_NOT_FOUND", null);
  if (result.code) return errorResponse("DRAFT_STATE_CONFLICT", null);
  return Response.json({ draftId:payload.draftId, status:"confirmed", itemIds:result.itemIds ?? [] });
}
