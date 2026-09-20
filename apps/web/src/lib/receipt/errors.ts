import { NextResponse } from "next/server";

export type OcrErrorCode = "INVALID_IMAGE" | "INVALID_REQUEST" | "AUTH_REQUIRED" | "OBJECT_FORBIDDEN" | "DRAFT_NOT_FOUND" | "DRAFT_STATE_CONFLICT" | "IDEMPOTENCY_MISMATCH" | "IMAGE_TOO_LARGE" | "OCR_INVALID_RESPONSE" | "OCR_QUOTA_EXHAUSTED" | "VISION_UNAVAILABLE" | "VISION_TIMEOUT";
const status: Record<OcrErrorCode, number> = { INVALID_IMAGE:400, INVALID_REQUEST:400, AUTH_REQUIRED:401, OBJECT_FORBIDDEN:403, DRAFT_NOT_FOUND:404, DRAFT_STATE_CONFLICT:409, IDEMPOTENCY_MISMATCH:409, IMAGE_TOO_LARGE:413, OCR_INVALID_RESPONSE:422, OCR_QUOTA_EXHAUSTED:429, VISION_UNAVAILABLE:502, VISION_TIMEOUT:504 };
export function errorResponse(code: OcrErrorCode, requestId: string | null, message = "No se pudo procesar el ticket") {
  return NextResponse.json({ code, message, retryable: code === "VISION_UNAVAILABLE" || code === "VISION_TIMEOUT", requestId }, { status: status[code] });
}
