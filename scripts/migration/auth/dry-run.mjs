import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildImportPlan, summarizePlan } from "./plan.mjs";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/migration/auth/dry-run.mjs <firebase-users.json>");

const parsed = JSON.parse(await readFile(resolve(input), "utf8"));
const users = Array.isArray(parsed) ? parsed : parsed.users;
if (!Array.isArray(users)) throw new Error("firebase_export_must_contain_users_array");

const existing = new Set(
  String(process.env.MIGRATION_EXISTING_FIREBASE_UIDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const plan = buildImportPlan(users, existing);

// Deliberately emit aggregate data only: never serialize source users or hashes.
process.stdout.write(`${JSON.stringify(summarizePlan(plan), null, 2)}\n`);
