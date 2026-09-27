import { describe, expect, it } from "vitest";
import catalogNameIndex from "./catalog-name-index.json";
import { matchingCatalogNames } from "./candidate-names";
import { matchIngredient } from "./matcher";

describe("catalog candidate index", () => {
  it("matches the existing matcher for a representative catalog sample", () => {
    const inventory = ["milk", "apple", "salt", "tomato"].map((name, index) => ({ id: String(index), name }));
    const vocabulary = [{ id: "milk", name: "milk", normalizedName: "milk", aliases: ["leche"] }];
    const mappings = [{ scannedName: "apple", normalizedName: "manzana", verifiedByUser: true }];
    const result = new Set(matchingCatalogNames({ checksum: catalogNameIndex.checksum, inventory, vocabulary, mappings }));
    for (const name of catalogNameIndex.names.filter((_, index) => index % 107 === 0)) {
      expect(result.has(name), name).toBe(matchIngredient(name, inventory, vocabulary, mappings) !== null);
    }
  });

  it("rejects an index built for another catalog version", () => {
    expect(() => matchingCatalogNames({ checksum: "other", inventory: [], vocabulary: [], mappings: [] })).toThrow("CATALOG_INDEX_STALE");
  });
});
