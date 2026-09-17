import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src", import.meta.url));
const violations = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(path))) {
      const source = await readFile(path, "utf8");
      if (source.includes("SUPABASE_SERVICE_ROLE_KEY") && !path.endsWith(join("supabase", "admin.ts"))) violations.push(relative(root, path));
      if (path.endsWith(join("supabase", "admin.ts")) && !source.startsWith('import "server-only"')) violations.push("admin.ts lacks server-only guard");
    }
  }
}
await scan(root);
if (violations.length) throw new Error(`Supabase secret boundary violation: ${violations.join(", ")}`);
console.log("Supabase server/browser boundary check passed.");
