import { createServerSupabaseClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/receipt/errors";
import { parseReceipt } from "@/lib/receipt/parser";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorResponse("AUTH_REQUIRED", null);

  const { data, error } = await supabase.from("receipt_drafts")
    .select("id,raw_text,ocr_locale")
    .eq("user_id", user.id)
    .eq("status", "review")
    .is("deleted_at", null)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return errorResponse("DRAFT_STATE_CONFLICT", null);
  if (!data) return errorResponse("DRAFT_NOT_FOUND", null, "No hay ningún ticket pendiente de revisión");

  return Response.json({ draftId: data.id, draft: parseReceipt(data.raw_text, data.ocr_locale ?? "es-ES") }, { headers: { "Cache-Control": "no-store" } });
}
