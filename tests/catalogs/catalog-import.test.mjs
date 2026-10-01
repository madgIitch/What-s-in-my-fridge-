import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { canonicalProducts, loadCatalog, run } from "../../scripts/catalogs/import-catalog.mjs";

describe("R1 catalog ingestion", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  it.each([
    [{ products: [{ id: "1", name: "Aceite" }] }],
    [[{ product_id: "1", title: "Aceite" }]],
    [{ items: [{ sku: "1", description: "Aceite" }] }],
    [{ results: [{ code: "1", display_name: "Aceite" }] }],
    [{ data: { products: [{ ean: "8410000000000", name: "Aceite" }] } }],
  ])("adapts a canonical input shape", (fixture) => expect(canonicalProducts("eroski", fixture)[0]).toMatchObject({ display_name: "Aceite" }));

  it("validates the frozen real Eroski checkpoint and ignores metrics quantity", async () => {
    const file = resolve(root, "docs/catalogs/data/eroski_checkpoint.json");
    const result = await loadCatalog({ retailer: "eroski", file, manifestFile: resolve(root, "docs/catalogs/local-sources.manifest.json") });
    expect(result.products).toHaveLength(23172); expect(result.products[0]).not.toHaveProperty("quantity");
    const bytes = await readFile(file);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(result.manifest.sha256);
  }, 30_000);

  it.each(["mercadona", "dia", "lidl", "carrefour"])("reports %s as absent", async (retailer) => {
    await expect(run([retailer, "--dry-run"])).resolves.toMatchObject({ status: "absent", imported: 0 });
  });
  it("does not ingest Aldi in R1", () => expect(() => canonicalProducts("aldi", [])).not.toThrow());
});
