import { describe, expect, it } from "vitest";
import { matchIngredient, normalizeIngredient, suggestRecipes } from "./index";

describe("matcher-v1 golden behavior", () => {
  it("normalizes accents and plurals deterministically", () => expect(normalizeIngredient("  Limónes  ")).toBe("limon"));
  it.each([
    ["tomato", "tomato", "exact"],
    ["garlic", "ajo", "alias"],
    ["olive oil", "extra virgin olive oil", "substring"],
    ["red pepper flakes", "pepper powder", "keyword"],
    ["chikcen", "chicken", "fuzzy"],
  ])("matches %s through %s", (requested, stocked, strategy) => {
    const result = matchIngredient(requested, [{ id: "i", name: stocked }], [{ id: "v", name: "garlic", aliases: ["ajo"] }]);
    expect(result?.strategy).toBe(strategy);
  });
  it("prioritizes verified mappings", () => expect(matchIngredient("aubergine", [{ id: "i", name: "eggplant" }], [], [{ scannedName: "eggplant", normalizedName: "aubergine", verifiedByUser: true }])?.strategy).toBe("verified"));
  it("returns empty for empty inventory and breaks ties by external id", () => {
    expect(suggestRecipes({ inventory: [], recipes: [] })).toEqual([]);
    const recipes = ["b", "a"].map((externalId) => ({ id: externalId, externalId, name: externalId, ingredients: [{ name: "salt" }] }));
    expect(suggestRecipes({ inventory: [{ id: "1", name: "salt" }], recipes }).map((recipe) => recipe.id)).toEqual(["a", "b"]);
  });
});
