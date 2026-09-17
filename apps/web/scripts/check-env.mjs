import { readFile } from "node:fs/promises";

const env = await readFile(new URL("../../../.env.example", import.meta.url), "utf8");
const sensitive = /^(NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE|VISION|FIREBASE_PRIVATE|MIGRATION).*)=/gm;
const exposed = [...env.matchAll(sensitive)].map((match) => match[1]);
if (exposed.length) throw new Error(`Sensitive variables exposed to browser: ${exposed.join(", ")}`);
console.log("Environment boundary check passed.");
