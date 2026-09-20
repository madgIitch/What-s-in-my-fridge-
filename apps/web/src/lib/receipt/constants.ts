export const RECEIPT_BUCKET = "receipt-images";
export const SIGNED_RECEIPT_URL_TTL_SECONDS = 60;
export function receiptObjectPath(userId: string, draftId: string, mime: string) { const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"; return `${userId}/${draftId}/original.${ext}`; }
