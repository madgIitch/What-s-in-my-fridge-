export const MAX_RECEIPT_IMAGE_BYTES = 10 * 1024 * 1024;
export type ReceiptMime = "image/jpeg" | "image/png" | "image/webp";

export function detectReceiptImage(bytes: Uint8Array): ReceiptMime | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) return "image/jpeg";
  if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" && ["VP8 ", "VP8L", "VP8X"].includes(String.fromCharCode(...bytes.slice(12, 16)))) return "image/webp";
  return null;
}

export function imageHasDimensions(bytes: Uint8Array, mime: ReceiptMime): boolean {
  if (mime === "image/png") return new DataView(bytes.buffer, bytes.byteOffset).getUint32(16) > 0 && new DataView(bytes.buffer, bytes.byteOffset).getUint32(20) > 0;
  if (mime === "image/webp") return bytes.length >= 30;
  for (let i = 2; i + 8 < bytes.length;) {
    if (bytes[i] !== 0xff) return false;
    const marker = bytes[i + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return bytes[i + 5] > 0 || bytes[i + 6] > 0;
    const length = (bytes[i + 2] << 8) | bytes[i + 3]; if (length < 2) return false; i += length + 2;
  }
  return false;
}

export function validateReceiptImage(bytes: Uint8Array, declaredMime: string): ReceiptMime {
  if (!bytes.length || bytes.length > MAX_RECEIPT_IMAGE_BYTES) throw new Error(bytes.length > MAX_RECEIPT_IMAGE_BYTES ? "IMAGE_TOO_LARGE" : "INVALID_IMAGE");
  const detected = detectReceiptImage(bytes);
  if (!detected || detected !== declaredMime || !imageHasDimensions(bytes, detected)) throw new Error("INVALID_IMAGE");
  return detected;
}
