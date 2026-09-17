import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const forbidden = ["react-native", "expo", "@react-native-firebase", "@nozbe/watermelondb"];
const failures = [];
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(path))) {
      const source = await readFile(path, "utf8");
      for (const dependency of forbidden) if (source.includes(`from \"${dependency}`) || source.includes(`from '${dependency}`) || source.includes(`require(\"${dependency}`)) failures.push(`${path}: ${dependency}`);
    }
  }
}
await scan(fileURLToPath(new URL("../src", import.meta.url)));
if (failures.length) throw new Error(`Legacy imports found:\n${failures.join("\n")}`);
console.log("Web boundary check passed.");
