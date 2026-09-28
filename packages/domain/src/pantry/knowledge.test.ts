import { describe, expect, it } from "vitest";
import type { InventoryItem } from "../index";
import {
  ingredientAvailability,
  projectLegacyInventoryItem,
  recipeAvailability,
  validatePantryKnowledge,
  type PantryItemKnowledge,
} from "./knowledge";

const base: PantryItemKnowledge = {
  id: "item-1",
  foodConceptId: null,
  commercialProductId: null,
  displayName: "Huevos",
  stock: { mode: "presence", quantityPrecision: "unknown", state: "present" },
  freshness: { precision: "unknown" },
};

describe("pantry knowledge", () => {
  it.each(["present", "absent", "unknown"] as const)("validates presence state %s without quantity", (state) => {
    expect(validatePantryKnowledge({ ...base, stock: { mode: "presence", quantityPrecision: "unknown", state } })).toBe(true);
  });
  it.each(["plenty", "some", "low", "empty"] as const)("validates qualitative state %s", (state) => {
    expect(validatePantryKnowledge({ ...base, stock: { mode: "qualitative", quantityPrecision: "unknown", state } })).toBe(true);
  });
  it.each(["package", "user", "retailer"] as const)("accepts an exact civil date with %s provenance", (source) => {
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "exact", source, expiryDateExact: "2026-10-01" } })).toBe(true);
  });
  it.each(["package", "user", "retailer", "receipt", "catalog"] as const)("accepts an estimate with %s provenance", (source) => {
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "estimated", source, windowDays: 7 } })).toBe(true);
  });
  it("represents presence, qualitative stock and exact quantity without contradiction", () => {
    expect(validatePantryKnowledge(base)).toBe(true);
    expect(validatePantryKnowledge({ ...base, stock: { mode: "qualitative", quantityPrecision: "unknown", state: "low" } })).toBe(true);
    expect(validatePantryKnowledge({ ...base, stock: { mode: "exact", quantityPrecision: "exact", quantity: 2, unit: "unit", state: "some" } })).toBe(true);
    expect(validatePantryKnowledge({ ...base, stock: { mode: "exact", quantityPrecision: "exact", quantity: 0, unit: "unit", state: "plenty" } })).toBe(false);
    expect(validatePantryKnowledge({ ...base, stock: { mode: "presence", quantityPrecision: "unknown", state: "present", quantity: 4 } as unknown as PantryItemKnowledge["stock"] })).toBe(false);
  });

  it("keeps estimated freshness separate from an exact civil expiry date", () => {
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "estimated", source: "receipt", acquiredOn: "2026-09-28", windowDays: 7 } })).toBe(true);
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "estimated", source: "legacy", windowDays: 7 } as unknown as PantryItemKnowledge["freshness"] })).toBe(false);
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "exact", source: "package", expiryDateExact: "2026-02-30" } })).toBe(false);
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "exact", source: "user", expiryDateExact: "2026-10-01" } })).toBe(true);
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "estimated", source: "catalog", windowDays: 7, expiryDateExact: "2026-10-01" } as unknown as PantryItemKnowledge["freshness"] })).toBe(false);
  });

  it("does not promote legacy quantities or dates to exact knowledge", () => {
    const legacy = {
      id: "item-1", userId: "user-1", source: "APP", legacyId: null, deletedAt: null,
      version: 1, name: "Huevos", normalizedName: null, expiryDate: "2026-10-01",
      category: null, quantity: 6, notes: null, unit: "unit", addedAt: "2026-09-28T00:00:00Z",
    } satisfies InventoryItem;
    const projected = projectLegacyInventoryItem(legacy);
    expect(projected.stock).toEqual({ mode: "presence", quantityPrecision: "unknown", state: "unknown" });
    expect(projected.freshness).toEqual({ precision: "unknown" });
    expect(projected.legacyQuantity).toBe(6);
    expect(projected.legacyExpiryDate).toBe("2026-10-01");
    expect(ingredientAvailability(projected, { quantity: 2, unit: "unit" })).toBe("unknown");
  });

  it("keeps unknown amounts distinct from sufficient and missing ingredients", () => {
    expect(ingredientAvailability(base, { quantity: 2, unit: "unit" })).toBe("have_presence_unknown_amount");
    expect(ingredientAvailability({ ...base, stock: { mode: "presence", quantityPrecision: "unknown", state: "absent" } }, { quantity: 2, unit: "unit" })).toBe("missing");
    expect(ingredientAvailability({ ...base, stock: { mode: "qualitative", quantityPrecision: "unknown", state: "low" } }, { quantity: 2, unit: "unit" })).toBe("have_presence_unknown_amount");
    const exact = { ...base, stock: { mode: "exact" as const, quantityPrecision: "exact" as const, quantity: 3, unit: "unit" } };
    expect(ingredientAvailability(exact, { quantity: 2, unit: "unit" })).toBe("have_enough");
    expect(ingredientAvailability(exact, { quantity: 4, unit: "unit" })).toBe("missing");
    expect(ingredientAvailability(exact, { quantity: 2, unit: "g" })).toBe("unknown");
    expect(ingredientAvailability(null)).toBe("missing");
    expect(recipeAvailability(["have_enough", "have_presence_unknown_amount"]).state).toBe("quantity_to_check");
    expect(recipeAvailability(["missing", "unknown"]).missingCount).toBe(1);
    expect(recipeAvailability(["have_enough"]).state).toBe("ready");
    expect(recipeAvailability(["unknown"]).state).toBe("unknown");
    expect(recipeAvailability([]).state).toBe("unknown");
  });
});
