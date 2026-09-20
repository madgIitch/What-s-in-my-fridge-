import "server-only";
import { createSign } from "node:crypto";
import type { VisionAdapter, VisionInput, VisionResult } from "./types";

const TIMEOUT_MS = 15_000;
const MAX_RESPONSE_CHARS = 250_000;

export class VisionError extends Error { constructor(public code: "VISION_TIMEOUT" | "VISION_UNAVAILABLE" | "OCR_INVALID_RESPONSE") { super(code); } }

type ServiceAccount = { client_email:string;private_key:string;token_uri?:string };
let cachedAccessToken: { value:string;expiresAt:number } | null = null;
const encode = (value:string|Buffer) => Buffer.from(value).toString("base64url");

async function serviceAccountToken(raw:string):Promise<string>{
  if(cachedAccessToken && cachedAccessToken.expiresAt>Date.now()+60_000)return cachedAccessToken.value;
  let account:ServiceAccount;try{account=JSON.parse(raw) as ServiceAccount}catch{throw new VisionError("VISION_UNAVAILABLE")}
  if(!account.client_email||!account.private_key)throw new VisionError("VISION_UNAVAILABLE");
  const now=Math.floor(Date.now()/1000),tokenUri=account.token_uri??"https://oauth2.googleapis.com/token";
  const unsigned=`${encode(JSON.stringify({alg:"RS256",typ:"JWT"}))}.${encode(JSON.stringify({iss:account.client_email,scope:"https://www.googleapis.com/auth/cloud-platform",aud:tokenUri,iat:now,exp:now+3600}))}`;
  const signature=createSign("RSA-SHA256").update(unsigned).sign(account.private_key);
  const assertion=`${unsigned}.${encode(signature)}`;
  const response=await fetch(tokenUri,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
  if(!response.ok)throw new VisionError("VISION_UNAVAILABLE");
  const body=await response.json() as {access_token?:unknown;expires_in?:unknown};
  if(typeof body.access_token!=="string")throw new VisionError("VISION_UNAVAILABLE");
  cachedAccessToken={value:body.access_token,expiresAt:Date.now()+(typeof body.expires_in==="number"?body.expires_in:3600)*1000};
  return body.access_token;
}

async function callGoogle(input: VisionInput): Promise<VisionResult> {
  const key = process.env.GOOGLE_VISION_API_KEY;
  const credentials = process.env.GOOGLE_CLOUD_VISION_CREDENTIALS_JSON;
  if (!key && !credentials) throw new VisionError("VISION_UNAVAILABLE");
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const accessToken=credentials?await serviceAccountToken(credentials):null;
    const endpoint=key?`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`:"https://vision.googleapis.com/v1/images:annotate";
    const response = await fetch(endpoint, { method:"POST", signal:controller.signal, headers:{"content-type":"application/json",...(accessToken?{authorization:`Bearer ${accessToken}`}:{})}, body:JSON.stringify({requests:[{image:{content:Buffer.from(input.bytes).toString("base64")},features:[{type:"DOCUMENT_TEXT_DETECTION"}]}]}) });
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
