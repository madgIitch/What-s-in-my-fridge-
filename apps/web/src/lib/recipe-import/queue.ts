import "server-only";
import { createSign } from "node:crypto";

let cachedToken: { value: string; expiresAt: number } | undefined;

async function cloudTasksAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const email = process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GCP_TASKS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("QUEUE_NOT_CONFIGURED");
  const now = Math.floor(Date.now() / 1000);
  const encoded = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encoded({ alg: "RS256", typ: "JWT" })}.${encoded({ iss: email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const signer = createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
  const assertion = `${unsigned}.${signer.sign(key, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("QUEUE_AUTH_FAILED");
  const result = await response.json() as { access_token?: string; expires_in?: number };
  if (!result.access_token) throw new Error("QUEUE_AUTH_FAILED");
  cachedToken = { value: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

export async function enqueueRecipeJob(jobId: string): Promise<void> {
  const endpoint = process.env.CLOUD_TASKS_ENQUEUE_URL;
  if (!endpoint) {
    if (process.env.NODE_ENV === "production") throw new Error("QUEUE_NOT_CONFIGURED");
    return;
  }
  const workerUrl = process.env.CLOUD_RUN_WORKER_URL;
  const serviceAccountEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL;
  if (!workerUrl || !serviceAccountEmail) throw new Error("QUEUE_NOT_CONFIGURED");
  const token = await cloudTasksAccessToken();
  const body = {
    task: { httpRequest: { httpMethod: "POST", url: workerUrl, headers: { "Content-Type": "application/json" },
      body: Buffer.from(JSON.stringify({ jobId })).toString("base64"), oidcToken: { serviceAccountEmail, audience: workerUrl } } },
  };
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(8_000) });
  if (!response.ok && response.status !== 409) throw new Error("QUEUE_UNAVAILABLE");
}
