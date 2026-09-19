import { spawn } from "node:child_process";
import { resolve } from "node:path";

const required = [
  "MIGRATION_ENVIRONMENT",
  "MIGRATION_FIREBASE_USERS_FILE",
  "MIGRATION_FIREBASE_IMPORT_SCRIPT",
  "MIGRATION_FIREBASE_HASH_SIGNER_KEY",
  "MIGRATION_FIREBASE_HASH_SALT_SEPARATOR",
  "MIGRATION_FIREBASE_HASH_ROUNDS",
  "MIGRATION_FIREBASE_HASH_MEM_COST",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Missing migration configuration: ${missing.join(", ")}`);
if (process.env.MIGRATION_ENVIRONMENT === "production") throw new Error("production_import_requires_cutover_tooling");
if (process.env.MIGRATION_CONFIRM_WRITE !== "IMPORT_FIREBASE_AUTH") throw new Error("dry_run_only_set_MIGRATION_CONFIRM_WRITE_to_import");

const child = spawn(process.execPath, [resolve(process.env.MIGRATION_FIREBASE_IMPORT_SCRIPT), resolve(process.env.MIGRATION_FIREBASE_USERS_FILE)], {
  stdio: ["ignore", "inherit", "inherit"],
  env: process.env,
  shell: false,
});
child.on("exit", (code) => process.exit(code ?? 1));
