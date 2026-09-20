import "server-only";
import { createHash } from "node:crypto";
export function receiptRequestHash(bytes: Uint8Array, locale: string) { return createHash("sha256").update(bytes).update("\0").update(locale).digest("hex"); }
