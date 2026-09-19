import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [input] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!input) throw new Error("Usage: node scripts/migration/auth/link-identities.mjs <uid-map.json>");
if (!url || !secret) throw new Error("missing_supabase_server_configuration");
if (process.env.MIGRATION_ENVIRONMENT === "production") throw new Error("production_link_requires_cutover_tooling");
if (process.env.MIGRATION_CONFIRM_WRITE !== "IMPORT_FIREBASE_AUTH") throw new Error("write_confirmation_required");

const mappings = JSON.parse(await readFile(resolve(input), "utf8"));
if (!Array.isArray(mappings)) throw new Error("uid_map_must_be_an_array");

let linked = 0;
for (const mapping of mappings) {
  if (typeof mapping?.firebaseUid !== "string" || typeof mapping?.supabaseUserId !== "string") throw new Error("invalid_uid_mapping");
  const response = await fetch(`${url}/rest/v1/rpc/link_firebase_auth_identity`, {
    method: "POST",
    headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ target_user_id: mapping.supabaseUserId, firebase_uid: mapping.firebaseUid }),
  });
  if (!response.ok) throw new Error(`identity_link_failed_at_index_${linked}`);
  linked += 1;
}
process.stdout.write(`${JSON.stringify({ linked })}\n`);
