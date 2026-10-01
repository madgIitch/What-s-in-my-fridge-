#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";

export const R1_RETAILERS = ["mercadona", "dia", "lidl", "carrefour", "eroski"];

const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
const first = (...values) => values.find(nonEmpty)?.trim() ?? null;

/** Accepts the five canonical fixture shapes used by the retailer adapters. */
export function canonicalProducts(retailer, input) {
  const rows = Array.isArray(input) ? input
    : Array.isArray(input?.products) ? input.products
      : Array.isArray(input?.items) ? input.items
        : Array.isArray(input?.results) ? input.results
          : Array.isArray(input?.data?.products) ? input.data.products : [];
  return rows.map((row, index) => {
    const retailerProductId = first(row.retailer_product_id, row.id, row.product_id, row.sku, row.code);
    const barcode = first(row.barcode, row.ean, row.ean13, row.gtin);
    const displayName = first(row.display_name, row.name, row.title, row.description);
    if ((!retailerProductId && !barcode) || !displayName) return { rejected: true, index, reason: "missing_identity_or_name" };
    return { retailer, retailer_product_id: retailerProductId, barcode, display_name: displayName,
      provenance: { brand: row.brand ?? null, category: row.category ?? null, source_page: row.source_page ?? null },
      // Deliberately exclude metrics_item.quantity: it is commercial analytics.
    };
  });
}

export async function loadCatalog({ retailer, file, manifestFile }) {
  if (!R1_RETAILERS.includes(retailer)) throw new Error(`Retailer fuera de R1: ${retailer}`);
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.sources)) throw new Error("Manifest schema_version inválido");
  const relative = file.replaceAll("\\", "/").split("docs/catalogs/").at(-1);
  const source = manifest.sources.find((entry) => entry.retailer === retailer && entry.file.replaceAll("\\", "/") === relative);
  if (!source) throw new Error(`Fuente ausente para ${retailer}: ${relative}`);
  const bytes = await readFile(file); const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== source.sha256) throw new Error(`Checksum inválido para ${basename(file)}`);
  const input = JSON.parse(bytes.toString("utf8")); const adapted = canonicalProducts(retailer, input);
  const products = adapted.filter((entry) => !entry.rejected); const rejected = adapted.length - products.length;
  if (source.product_count !== adapted.length) throw new Error(`Cardinalidad inválida: manifest=${source.product_count}, archivo=${adapted.length}`);
  if (source.completeness === "empty" || products.length === 0) throw new Error("Un export vacío no puede sustituir un catálogo útil");
  return { manifest: { retailer, schema_version: manifest.schema_version, source: source.source,
    captured_at: source.captured_at, fetched_at: source.fetched_at, sha256, completeness: source.completeness,
    product_count: products.length }, products, rejected };
}

async function postImport(payload) {
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorios sin --dry-run");
  const response = await fetch(`${url}/rest/v1/rpc/import_retailer_catalog_v1`, { method: "POST", headers: {
    apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ p_manifest: payload.manifest, p_products: payload.products }) });
  if (!response.ok) throw new Error(`Import fallido (${response.status})`);
  return response.json();
}

export async function run(argv = process.argv.slice(2)) {
  const retailer = argv.find((value) => !value.startsWith("--")); const dryRun = argv.includes("--dry-run");
  if (!retailer || !R1_RETAILERS.includes(retailer)) throw new Error(`Uso: import-catalog.mjs <${R1_RETAILERS.join("|")}> [--file path] [--dry-run]`);
  const fileFlag = argv.indexOf("--file"); const manifestFlag = argv.indexOf("--manifest");
  const manifestFile = resolve(manifestFlag >= 0 ? argv[manifestFlag + 1] : "docs/catalogs/local-sources.manifest.json");
  const file = fileFlag >= 0 ? resolve(argv[fileFlag + 1]) : retailer === "eroski" ? resolve("docs/catalogs/data/eroski_checkpoint.json") : null;
  if (!file) return { retailer, status: "absent", imported: 0, rejected: 0 };
  const payload = await loadCatalog({ retailer, file, manifestFile });
  if (dryRun) return { retailer, status: "dry-run", imported: payload.products.length, rejected: payload.rejected, sha256: payload.manifest.sha256 };
  return { retailer, status: "imported", ...(await postImport(payload)) };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) {
  run().then((report) => console.log(JSON.stringify(report))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
