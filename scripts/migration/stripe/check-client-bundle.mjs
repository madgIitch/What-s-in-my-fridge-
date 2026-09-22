import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dirname, "../../../apps/web/.next/static");
if (!existsSync(root)) throw new Error("Run the production web build before checking client artifacts");

const secretNames = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_RECONCILE_SECRET", "BILLING_ADMIN_SECRET"];
const secretValues = secretNames.map((name) => process.env[name]).filter((value) => value && value.length >= 8);
const forbidden = [...secretNames, ...secretValues];
let files = 0;
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { scan(path); continue; }
    if (!entry.isFile()) continue;
    files++;
    const content = readFileSync(path, "utf8");
    if (forbidden.some((value) => content.includes(value))) throw new Error(`Secret marker found in client artifact ${entry.name}`);
  }
}
scan(root);
if (files === 0) throw new Error("No client artifacts were inspected");
process.stdout.write(`Checked ${files} client artifacts: no server secret markers found.\n`);
