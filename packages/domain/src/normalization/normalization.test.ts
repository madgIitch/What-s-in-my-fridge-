import { describe, expect, it } from "vitest";
import { fuzzyCandidates, normalizeReceiptLine, normalizeReceiptText, receiptQuantityKnowledge } from "./index";

const concepts = [
  { foodConceptId: "1", slug: "pasta", displayName: "Pasta" },
  { foodConceptId: "2", slug: "pasta-fresca", displayName: "Pasta fresca" },
  { foodConceptId: "3", slug: "tomate", displayName: "Tomate" },
  { foodConceptId: "4", slug: "pasta-integral", displayName: "Pasta integral" },
];

describe("receipt normalization v2", () => {
  it("normalizes case, accents and whitespace", () => expect(normalizeReceiptText("  PÁSTA   Fresca ")).toBe("pasta fresca"));
  it("returns at most three deterministic fuzzy suggestions without resolving", () => {
    expect(fuzzyCandidates("PASTA BIO", concepts).map((entry) => entry.slug)).toEqual(["pasta", "pasta-fresca", "pasta-integral"]);
    const line = normalizeReceiptLine({ lineId: "l1", rawName: "PASTA BIO", retailer: "dia" }, { userMappings: [], products: [], aliases: [], concepts });
    expect(line.resolution).toBe("doubtful"); expect(line.foodConceptId).toBeNull();
  });
  it("gives a private mapping precedence over identifiers and aliases", () => {
    const line = normalizeReceiptLine({ lineId: "l1", rawName: "PÁSTA BIO", retailer: "DIA", barcode: "123" }, {
      userMappings: [{ retailer: "dia", normalizedRawName: "pasta bio", foodConceptId: "3", displayName: "Mi tomate" }],
      products: [{ retailer: "dia", retailerProductId: null, barcode: "123", displayName: "Pasta", foodConceptId: "1" }],
      aliases: [{ normalizedAlias: "pasta bio", foodConceptId: "1" }], concepts,
    });
    expect(line).toMatchObject({ foodConceptId: "3", displayName: "Mi tomate", source: "user_mapping", resolution: "resolved" });
  });
  it("keeps synthetic parser quantities unknown and never expands packs", () => {
    expect(receiptQuantityKnowledge({ quantity: "1", unit: "unit", explicit: false })).toEqual({ precision: "unknown", reason: "synthetic" });
    expect(receiptQuantityKnowledge({ quantity: "1", unit: "pack", explicit: true, packContent: { quantity: 12, unit: "unit" } })).toEqual({ precision: "exact", quantity: 1, unit: "pack", evidence: "receipt" });
  });
});
