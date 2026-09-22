import { randomUUID } from "node:crypto";

const base = process.env.SUPABASE_LOCAL_URL;
const anon = process.env.SUPABASE_LOCAL_ANON_KEY;
const service = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;
if (!base || !anon || !service) throw new Error("Local Supabase URL, anon and service keys are required");
const url = new URL(base);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Refusing to run the concurrency test against a nonlocal Supabase project");

async function json(path, init, key = anon, bearer = key) {
  const response = await fetch(new URL(path, base), { ...init, headers: { apikey: key, Authorization: `Bearer ${bearer}`, "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Local Supabase request failed: ${response.status} ${path} (${body?.code ?? body?.error ?? "unknown"})`);
  return body;
}

const email = `stripe-concurrency-${randomUUID()}@example.test`;
const password = `Test-${randomUUID()}`;
let userId;
try {
  const created = await json("/auth/v1/signup", { method: "POST", body: JSON.stringify({ email, password }) });
  userId = created.user?.id;
  const session = created.access_token ? created : await json("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  const token = session.access_token;
  if (!userId || !token) throw new Error("Could not create a local test session");

  async function consume(feature, key) {
    return json("/rest/v1/rpc/consume_usage", { method: "POST", body: JSON.stringify({ p_feature: feature, p_idempotency_key: key }) }, anon, token);
  }
  async function override(value) {
    return json("/rest/v1/rpc/set_billing_override", { method: "POST", body: JSON.stringify({ p_user_id: userId, p_value: value, p_reason: "local concurrency test", p_actor: "billing-admin" }) }, service);
  }

  for (const [feature, limit] of [["receipt_ocr", 5], ["recipe_suggestions", 5], ["recipe_import", 10]]) {
    const attempts = await Promise.all(Array.from({ length: limit + 1 }, (_, index) => consume(feature, `${feature}-${index}-${randomUUID()}`)));
    const allowed = attempts.filter((item) => item.allowed).length;
    const denied = attempts.filter((item) => item.code === "QUOTA_EXCEEDED").length;
    if (allowed !== limit || denied !== 1) throw new Error(`${feature}: expected ${limit} allowed and one denial, got ${allowed} and ${denied}`);
    process.stdout.write(`${feature}: ${allowed} concurrent reservations allowed, one denied.\n`);
  }

  await override(true);
  const proResult = await consume("receipt_ocr", `pro-${randomUUID()}`);
  if (!proResult.allowed || proResult.used !== 5) throw new Error("Pro must bypass without incrementing Free usage");
  await override(null);
  const downgraded = await consume("receipt_ocr", `downgraded-${randomUUID()}`);
  if (downgraded.code !== "QUOTA_EXCEEDED") throw new Error("Downgrade must resume the prior Free counter");
  process.stdout.write("Pro bypass and downgrade retained the original Free counter.\n");
} finally {
  // A later local db reset removes the synthetic user; this script refuses nonlocal URLs.
}
