import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("web persistence boundary", () => {
  it("does not import Firebase, Firestore or WatermelonDB", () => {
    const root = resolve(process.cwd(), "src");
    const files = [
      "components/inventory-app.tsx", "lib/inventory/db.ts", "lib/inventory/repository.ts", "lib/inventory/sync.ts",
    ];
    const source = files.map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");
    expect(source).not.toMatch(/from\s+["'][^"']*(firebase|firestore|watermelondb)/i);
  });
});
