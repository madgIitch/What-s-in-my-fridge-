import "server-only";
import type { VisionAdapter, VisionInput, VisionResult } from "./types";

const TIMEOUT_MS = 15_000;
const MAX_RESPONSE_CHARS = 250_000;

export class VisionError extends Error { constructor(public code: "VISION_TIMEOUT" | "VISION_UNAVAILABLE" | "OCR_INVALID_RESPONSE") { super(code); } }

async function callGoogle(input: VisionInput): Promise<VisionResult> {
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) throw new VisionError("VISION_UNAVAILABLE");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`, { method:"POST", signal:controller.signal, headers:{"content-type":"application/json"}, body:JSON.stringify({requests:[{image:{content:Buffer.from(input.bytes).toString("base64")},features:[{type:"DOCUMENT_TEXT_DETECTION"}]}]}) });
    if (!response.ok) throw new VisionError("VISION_UNAVAILABLE");
    const json = await response.json() as { responses?: Array<{ fullTextAnnotation?: { text?: unknown }; error?: unknown }> };
    if (!Array.isArray(json.responses) || json.responses[0]?.error) throw new VisionError("OCR_INVALID_RESPONSE");
    const text = json.responses[0]?.fullTextAnnotation?.text;
    if (text !== undefined && typeof text !== "string") throw new VisionError("OCR_INVALID_RESPONSE");
    return { text: (text ?? "").slice(0, MAX_RESPONSE_CHARS) };
  } catch (error) {
    if (error instanceof VisionError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new VisionError("VISION_TIMEOUT");
    throw new VisionError("VISION_UNAVAILABLE");
  } finally { clearTimeout(timeout); }
}

// Quota is committed immediately before this call. Retrying here would create a
// second billable provider invocation for one request id, so retries are handled
// only by the persisted idempotency contract.
const googleAdapter: VisionAdapter = { recognize: callGoogle };
const mockAdapter: VisionAdapter = { recognize: async () => ({ text: process.env.OCR_MOCK_TEXT ?? "SUPERMERCADO DEMO\nLECHE 1,25 €\nTOTAL 1,25 €" }) };
export function getVisionAdapter(): VisionAdapter { return process.env.OCR_VISION_ADAPTER === "mock" ? mockAdapter : googleAdapter; }
