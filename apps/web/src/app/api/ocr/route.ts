import { createHash } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { validateReceiptImage } from "@/lib/receipt/image";
import { errorResponse, type OcrErrorCode } from "@/lib/receipt/errors";
import { parseReceipt, RECEIPT_PARSER_VERSION } from "@/lib/receipt/parser";
import { receiptObjectPath, RECEIPT_BUCKET } from "@/lib/receipt/constants";
import { getVisionAdapter, VisionError } from "@/lib/vision/server";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let requestId: string | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("AUTH_REQUIRED", null, "Inicia sesión para escanear un ticket");
    const form = await request.formData();
    if (["userId", "user_id", "owner", "ownerId"].some((field) => form.has(field))) return errorResponse("INVALID_REQUEST", null);
    const image = form.get("image"); const draftId = form.get("draftId"); requestId = String(form.get("requestId") ?? ""); const locale = String(form.get("locale") ?? "es-ES");
    if (!(image instanceof File) || typeof draftId !== "string" || !uuid.test(draftId) || !uuid.test(requestId) || locale.length > 35) return errorResponse("INVALID_REQUEST", requestId);
    const bytes = new Uint8Array(await image.arrayBuffer());
    let mime: string; try { mime = validateReceiptImage(bytes, image.type); } catch (error) { const code = error instanceof Error && error.message === "IMAGE_TOO_LARGE" ? "IMAGE_TOO_LARGE" : "INVALID_IMAGE"; return errorResponse(code, requestId); }
    const hash = createHash("sha256").update(bytes).digest("hex");
    const admin = createAdminSupabaseClient();
    const { data: reservation, error: reserveError } = await supabase.rpc("reserve_receipt_ocr", { p_draft_id:draftId, p_request_id:requestId, p_image_hash:hash, p_locale:locale });
    if (reserveError || !reservation) return errorResponse("DRAFT_STATE_CONFLICT", requestId);
    const result = reservation as { action:string; code?:OcrErrorCode; draft?:unknown };
    if (result.action === "replay") return Response.json({ draftId, requestId, status:"review", draft:result.draft });
    if (result.action === "failed") return errorResponse(result.code ?? "VISION_UNAVAILABLE", requestId);
    if (result.action === "reject") return errorResponse(result.code ?? "DRAFT_STATE_CONFLICT", requestId);
    const imagePath = receiptObjectPath(user.id, draftId, mime);
    const { error: uploadError } = await admin.storage.from(RECEIPT_BUCKET).upload(imagePath, bytes, { contentType:mime, upsert:false });
    if (uploadError) { await supabase.rpc("release_receipt_ocr", {p_draft_id:draftId}); return errorResponse("VISION_UNAVAILABLE", requestId); }
    await supabase.rpc("attach_receipt_image", {p_draft_id:draftId,p_image_path:imagePath});
    const { error: consumptionError } = await supabase.rpc("mark_receipt_vision_invoked", {p_draft_id:draftId});
    if (consumptionError) return errorResponse("DRAFT_STATE_CONFLICT", requestId);
    try {
      const vision = await getVisionAdapter().recognize({ bytes, mime, requestId });
      const draft = parseReceipt(vision.text, locale);
      const { error } = await supabase.rpc("complete_receipt_ocr", { p_draft_id:draftId, p_raw_text:vision.text, p_parser_version:RECEIPT_PARSER_VERSION, p_result:draft });
      if (error) return errorResponse("DRAFT_STATE_CONFLICT", requestId);
      return Response.json({ draftId, requestId, status:"review", draft });
    } catch (error) {
      const code: OcrErrorCode = error instanceof VisionError ? error.code : "VISION_UNAVAILABLE";
      await supabase.rpc("fail_receipt_ocr", {p_draft_id:draftId,p_error_code:code});
      return errorResponse(code, requestId);
    }
  } catch { return errorResponse("INVALID_REQUEST", requestId); }
}
