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
  stock: { mode: "presence", state: "present" },
  freshness: { precision: "unknown" },
};

describe("pantry knowledge", () => {
  it("represents presence, qualitative stock and exact quantity without contradiction", () => {
    expect(validatePantryKnowledge(base)).toBe(true);
    expect(validatePantryKnowledge({ ...base, stock: { mode: "qualitative", state: "low" } })).toBe(true);
    expect(validatePantryKnowledge({ ...base, stock: { mode: "exact", quantity: 2, unit: "unit", state: "some" } })).toBe(true);
    expect(validatePantryKnowledge({ ...base, stock: { mode: "exact", quantity: 0, unit: "unit", state: "plenty" } })).toBe(false);
  });

  it("keeps estimated freshness separate from an exact civil expiry date", () => {
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "estimated", source: "receipt", acquiredOn: "2026-09-28", windowDays: 7 } })).toBe(true);
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "estimated", source: "legacy" } })).toBe(false);
    expect(validatePantryKnowledge({ ...base, freshness: { precision: "exact", source: "package", expiryDateExact: "2026-02-30" } })).toBe(false);
  });

  it("does not promote legacy quantities or dates to exact knowledge", () => {
    const legacy = {
      id: "item-1", userId: "user-1", source: "APP", legacyId: null, deletedAt: null,
      version: 1, name: "Huevos", normalizedName: null, expiryDate: "2026-10-01",
      category: null, quantity: 6, notes: null, unit: "unit", addedAt: "2026-09-28T00:00:00Z",
    } satisfies InventoryItem;
    const projected = projectLegacyInventoryItem(legacy);
    expect(projected.stock).toEqual({ mode: "presence", state: "present" });
    expect(projected.freshness).toEqual({ precision: "unknown" });
    expect(projected.legacyQuantity).toBe(6);
    expect(projected.legacyExpiryDate).toBe("2026-10-01");
  });

  it("keeps unknown amounts distinct from sufficient and missing ingredients", () => {
    expect(ingredientAvailability(base, { quantity: 2, unit: "unit" })).toBe("have_presence_unknown_amount");
    const exact = { ...base, stock: { mode: "exact" as const, quantity: 3, unit: "unit" } };
    expect(ingredientAvailability(exact, { quantity: 2, unit: "unit" })).toBe("have_enough");
    expect(ingredientAvailability(exact, { quantity: 4, unit: "unit" })).toBe("missing");
    expect(ingredientAvailability(exact, { quantity: 2, unit: "g" })).toBe("unknown");
    expect(ingredientAvailability(null)).toBe("missing");
    expect(recipeAvailability(["have_enough", "have_presence_unknown_amount"]).state).toBe("quantity_to_check");
    expect(recipeAvailability(["missing", "unknown"]).missingCount).toBe(1);
  });
});
