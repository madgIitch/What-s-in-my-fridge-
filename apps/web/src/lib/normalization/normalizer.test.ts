import { describe, expect, it } from "vitest";
import { normalizeLine, normalizeText } from "./normalizer";

const knowledge = { mappings: [], products: [], aliases: [], concepts: [
  { id: "a", slug: "pasta", display_name: "Pasta", category: null },
  { id: "b", slug: "pasta-fresca", display_name: "Pasta fresca", category: null },
] };
describe("web receipt normalizer", () => {
  it("folds case, accents and whitespace", () => expect(normalizeText("  HÚEVOS  Camperos ")).toBe("huevos camperos"));
  it("never auto-resolves fuzzy and ignores synthetic 1/unit", () => {
    const result = normalizeLine({ lineId: "1", rawText: "PASTA BIO", name: "PASTA BIO", quantity: "1", unit: "unit" }, "dia", "2026-10-01", "receipt", knowledge);
    expect(result).toMatchObject({ resolution: "doubtful", foodConceptId: null, quantity: { precision: "unknown" } });
  });
  it("keeps conflicting exact identifiers doubtful when one product has no concept", () => {
    const result = normalizeLine({ lineId: "1", rawText: "PASTA", name: "PASTA", quantity: null, unit: null, barcode: "111", retailerProductId: "r-1" }, "dia", "2026-10-01", "receipt", {
      ...knowledge, aliases: [{ normalized_alias: "pasta", food_concept_id: "a" }], products: [
        { retailer: "dia", retailer_product_id: null, barcode: "111", display_name: "Pasta conocida", food_concept_id: "a" },
        { retailer: "dia", retailer_product_id: "r-1", barcode: null, display_name: "Producto desconocido", food_concept_id: null },
      ],
    });
    expect(result.resolution).toBe("doubtful"); expect(result.foodConceptId).toBeNull();
  });
});
