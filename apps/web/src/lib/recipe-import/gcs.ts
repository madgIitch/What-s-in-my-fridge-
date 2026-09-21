import "server-only";
import { createHash, createSign } from "node:crypto";

export function createUploadObject(userId: string, jobId: string, filename: string) {
  const safe = filename.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-100) || "media";
  return `recipe-imports/${userId}/${jobId}/${safe}`;
}

export function signGcsUpload(object: string, contentType: string, now = new Date()) {
  const bucket = required("GCS_TEMP_BUCKET"); const email = required("GCS_SIGNER_CLIENT_EMAIL");
  const key = required("GCS_SIGNER_PRIVATE_KEY").replace(/\\n/g, "\n");
  const stamp = now.toISOString().replace(/[-:]|\.\d{3}/g, ""); const day = stamp.slice(0, 8); const credential = `${email}/${day}/auto/storage/goog4_request`;
  const encoded = object.split("/").map(encodeURIComponent).join("/"); const host = "storage.googleapis.com"; const path = `/${bucket}/${encoded}`;
  const query = new URLSearchParams({ "X-Goog-Algorithm": "GOOG4-RSA-SHA256", "X-Goog-Credential": credential, "X-Goog-Date": stamp, "X-Goog-Expires": "900", "X-Goog-SignedHeaders": "content-type;host" }); query.sort();
  const headers = `content-type:${contentType}\nhost:${host}\n`; const canonical = `PUT\n${path}\n${query}\n${headers}\ncontent-type;host\nUNSIGNED-PAYLOAD`;
  const toSign = `GOOG4-RSA-SHA256\n${stamp}\n${day}/auto/storage/goog4_request\n${createHash("sha256").update(canonical).digest("hex")}`;
  const signer = createSign("RSA-SHA256"); signer.update(toSign); signer.end(); query.set("X-Goog-Signature", signer.sign(key, "hex"));
  return { uploadUrl: `https://${host}${path}?${query}`, object, expiresAt: new Date(now.getTime() + 900_000).toISOString() };
}
function required(name: string) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
