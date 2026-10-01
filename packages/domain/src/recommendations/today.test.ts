import { describe, expect, it } from "vitest";
import {
  evaluateTodayRecipe, parseRecipeQuantity, rankTodayDecisions, selectTodayDecisions,
  todayCacheProjection, type FoodConceptInput, type TodayPantryItem, type TodayRecipeInput,
} from "./today";

const concepts: FoodConceptInput[] = [
  { id: "egg", displayName: "Huevo", aliases: ["huevos"] },
  { id: "onion", displayName: "Cebolla", aliases: ["cebolla dulce", "común"] },
  { id: "other", displayName: "Otra", aliases: ["común"] },
];
const recipe = (ingredients: TodayRecipeInput["ingredients"], recipeId = "recipe-a", favorite = false): TodayRecipeInput => ({ recipeId, name: recipeId, ingredients, favorite });
const pantry = (overrides: Partial<TodayPantryItem> & Pick<TodayPantryItem, "id" | "foodConceptId">): TodayPantryItem => ({
  displayName: "Alimento", commercialProductId: null, normalizationStatus: "confirmed", deletedAt: null,
  stock: { mode: "presence", quantityPrecision: "unknown", state: "present" }, freshness: { precision: "unknown" },
  ...overrides,
});

describe("R2 quantity parser", () => {
  it("accepts only the approved positive decimal units", () => {
    expect(parseRecipeQuantity("1,5 kg")).toEqual({ quantity: 1500, unit: "g" });
    expect(parseRecipeQuantity("2 l")).toEqual({ quantity: 2000, unit: "ml" });
    expect(parseRecipeQuantity("3 unidades")).toEqual({ quantity: 3, unit: "unit" });
    expect(parseRecipeQuantity("2 packs")).toEqual({ quantity: 2, unit: "pack" });
    for (const value of ["1/2 kg", "1-2 kg", "al gusto", "1 lata de 400 g", "2 cucharadas", "0 g"]) expect(parseRecipeQuantity(value)).toBeNull();
  });
});

describe("R2 availability", () => {
  it("sums decimal requirements and stock without inventing a floating-point deficit", () => {
    const input = {
      recipe: recipe([{ name: "Cebolla", measure: "0.1 g" }, { name: "Cebolla", measure: "0,2 g" }]),
      concepts, today: "2026-10-02",
      pantry: [pantry({ id: "one", foodConceptId: "onion", stock: { mode: "exact" as const, quantityPrecision: "exact" as const, quantity: 0.3, unit: "g" } })],
    };
    expect(evaluateTodayRecipe(input).availability).toBe("ready");
    input.pantry[0] = pantry({ id: "one", foodConceptId: "onion", stock: { mode: "exact", quantityPrecision: "exact", quantity: 0.2, unit: "g" } });
    expect(evaluateTodayRecipe(input).shopping[0].deficitQuantity).toBe(0.1);
  });

  it("keeps ambiguous aliases unknown and identified absence missing", () => {
    const decision = evaluateTodayRecipe({ recipe: recipe([{ name: "común", measure: "1 unit" }, { name: "huevos", measure: "2 unit" }]), pantry: [], concepts, today: "2026-10-02" });
    expect(decision.availability).toBe("missing_one");
    expect(decision.missingIngredients).toEqual(["Huevo"]);
    expect(decision.unknownIngredients).toEqual(["común"]);
  });

  it("deduplicates a concept, converts and sums requirements and stock once", () => {
    const decision = evaluateTodayRecipe({
      recipe: recipe([{ name: "cebolla", measure: "250 g" }, { name: "cebolla dulce", measure: "0,25 kg" }]), concepts, today: "2026-10-02",
      pantry: [pantry({ id: "one", foodConceptId: "onion", stock: { mode: "exact", quantityPrecision: "exact", quantity: 0.5, unit: "kg" } })],
    });
    expect(decision.availability).toBe("ready");
    expect(decision.missingCount).toBe(0);
  });

  it("distinguishes exact deficit, qualitative presence, incompatible units and unknown recipe amount", () => {
    const exact = pantry({ id: "one", foodConceptId: "egg", stock: { mode: "exact", quantityPrecision: "exact", quantity: 1, unit: "unit" } });
    expect(evaluateTodayRecipe({ recipe: recipe([{ name: "egg", foodConceptId: "egg", measure: "2 unit" }]), pantry: [exact], concepts, today: "2026-10-02" }).shopping[0]).toMatchObject({ availability: "missing", deficitQuantity: 1, unit: "unit" });
    expect(evaluateTodayRecipe({ recipe: recipe([{ name: "egg", foodConceptId: "egg", measure: "2 unit" }]), pantry: [pantry({ id: "q", foodConceptId: "egg" })], concepts, today: "2026-10-02" }).availability).toBe("quantity_to_check");
    expect(evaluateTodayRecipe({ recipe: recipe([{ name: "egg", foodConceptId: "egg", measure: "2 unit" }]), pantry: [pantry({ id: "g", foodConceptId: "egg", stock: { mode: "exact", quantityPrecision: "exact", quantity: 20, unit: "g" } })], concepts, today: "2026-10-02" }).availability).toBe("unknown");
    expect(evaluateTodayRecipe({ recipe: recipe([{ name: "egg", foodConceptId: "egg", measure: "al gusto" }]), pantry: [exact], concepts, today: "2026-10-02" }).availability).toBe("quantity_to_check");
  });

  it("does not use empty, zero, tombstoned, proposed or legacy evidence", () => {
    const unusable: TodayPantryItem[] = [
      pantry({ id: "empty", foodConceptId: "egg", stock: { mode: "qualitative", quantityPrecision: "unknown", state: "empty" } }),
      pantry({ id: "zero", foodConceptId: "egg", stock: { mode: "exact", quantityPrecision: "exact", quantity: 0, unit: "unit", state: "empty" } }),
      pantry({ id: "gone", foodConceptId: "egg", deletedAt: "2026-10-01T00:00:00Z" }),
      pantry({ id: "proposed", foodConceptId: "egg", normalizationStatus: "proposed" }),
      pantry({ id: "legacy", foodConceptId: "egg", normalizationStatus: "unknown", knowledgeProvenance: "legacy" }),
    ];
    expect(evaluateTodayRecipe({ recipe: recipe([{ name: "egg", foodConceptId: "egg", measure: "1 unit" }]), pantry: unusable, concepts, today: "2026-10-02" }).availability).toBe("missing_one");
  });

  it("marks mixed required dimensions and exact plus unknown lines conservatively", () => {
    const stock = [pantry({ id: "one", foodConceptId: "onion", stock: { mode: "exact", quantityPrecision: "exact", quantity: 1000, unit: "g" } })];
    expect(evaluateTodayRecipe({ recipe: recipe([{ name: "onion", foodConceptId: "onion", measure: "2 unit" }, { name: "onion", foodConceptId: "onion", measure: "20 g" }]), pantry: stock, concepts, today: "2026-10-02" }).availability).toBe("unknown");
    expect(evaluateTodayRecipe({ recipe: recipe([{ name: "onion", foodConceptId: "onion", measure: "20 g" }, { name: "onion", foodConceptId: "onion", measure: null }]), pantry: stock, concepts, today: "2026-10-02" }).availability).toBe("quantity_to_check");
  });

  it("does not invent a numeric deficit for complete absence", () => {
    const decision = evaluateTodayRecipe({ recipe: recipe([{ name: "egg", foodConceptId: "egg", measure: "2 unit" }]), pantry: [], concepts, today: "2026-10-02" });
    expect(decision.shopping[0]).toMatchObject({ availability: "missing", deficitQuantity: null, unit: null });
  });

  it("keeps partial compatible plus incompatible or unsupported exact stock unknown", () => {
    const mixed = [
      pantry({ id: "units", foodConceptId: "egg", stock: { mode: "exact", quantityPrecision: "exact", quantity: 1, unit: "unit" } }),
      pantry({ id: "grams", foodConceptId: "egg", stock: { mode: "exact", quantityPrecision: "exact", quantity: 50, unit: "g" } }),
    ];
    expect(evaluateTodayRecipe({ recipe: recipe([{ name: "egg", foodConceptId: "egg", measure: "2 unit" }]), pantry: mixed, concepts, today: "2026-10-02" }).availability).toBe("unknown");
    const unsupported = pantry({ id: "dozen", foodConceptId: "egg", stock: { mode: "exact", quantityPrecision: "exact", quantity: 1, unit: "dozen" } });
    expect(evaluateTodayRecipe({ recipe: recipe([{ name: "egg", foodConceptId: "egg", measure: "2 unit" }]), pantry: [unsupported], concepts, today: "2026-10-02" }).availability).toBe("unknown");
  });
});

describe("R2 freshness, ranking and cache", () => {
  const candidate = (id: string, item: TodayPantryItem, favorite = false) => evaluateTodayRecipe({ recipe: recipe([{ name: "egg", foodConceptId: "egg", measure: "1 unit" }], id, favorite), pantry: [item], concepts, today: "2026-10-02" });

  it("distinguishes verified, estimated, past and legacy dates", () => {
    const base = { id: "one", foodConceptId: "egg", stock: { mode: "exact", quantityPrecision: "exact", quantity: 2, unit: "unit" } } as const;
    expect(candidate("verified", pantry({ ...base, freshness: { precision: "exact", expiryDateExact: "2026-10-04", source: "package" } })).freshness).toBe("verified");
    expect(candidate("estimated", pantry({ ...base, freshness: { precision: "estimated", acquiredOn: "2026-09-28", windowDays: 6, source: "catalog" } })).freshness).toBe("estimated");
    expect(candidate("past", pantry({ ...base, freshness: { precision: "exact", expiryDateExact: "2026-10-01", source: "user" } })).freshness).toBe("none");
    expect(candidate("legacy", pantry({ ...base, freshness: { precision: "unknown" }, legacyExpiryDate: "2026-10-03" })).freshness).toBe("none");
    expect(candidate("zero-window", pantry({ ...base, freshness: { precision: "estimated", acquiredOn: "2026-10-04", windowDays: 0, source: "catalog" } })).freshness).toBe("none");
  });

  it("is stable across input permutations and applies favorite only after freshness", () => {
    const item = pantry({ id: "one", foodConceptId: "egg", stock: { mode: "exact", quantityPrecision: "exact", quantity: 2, unit: "unit" } });
    const decisions = [candidate("b", item, true), candidate("a", item), candidate("c", item)];
    expect(rankTodayDecisions(decisions).map((entry) => entry.recipeId)).toEqual(["b", "a", "c"]);
    expect(rankTodayDecisions([...decisions].reverse()).map((entry) => entry.recipeId)).toEqual(["b", "a", "c"]);
  });

  it("limits main/secondary and only includes useful non-unknown freshness in secondary", () => {
    const fresh = pantry({ id: "one", foodConceptId: "egg", stock: { mode: "exact", quantityPrecision: "exact", quantity: 2, unit: "unit" }, freshness: { precision: "exact", expiryDateExact: "2026-10-03", source: "retailer" } });
    const decisions = Array.from({ length: 8 }, (_, index) => candidate(`r${index}`, fresh));
    const selected = selectTodayDecisions(decisions);
    expect(selected.main).toHaveLength(3); expect(selected.secondary).toHaveLength(3);
    expect(new Set([...selected.main, ...selected.secondary].map((item) => item.recipeId)).size).toBe(6);
  });

  it("produces the same projection for key order but changes with relevant inputs", () => {
    expect(todayCacheProjection({ pantry: [{ id: "a", state: "some" }], date: "2026-10-02" })).toBe(todayCacheProjection({ date: "2026-10-02", pantry: [{ state: "some", id: "a" }] }));
    expect(todayCacheProjection({ date: "2026-10-02" })).not.toBe(todayCacheProjection({ date: "2026-10-03" }));
  });
});
