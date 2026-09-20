import { describe, expect, it } from "vitest";
import { matchIngredient, normalizeIngredient, suggestRecipes } from "./matcher";

const vocabulary = [{ id: "garlic", name: "garlic", normalizedName: "garlic", category: null, aliases: ["ajo"] }];
describe("matcher-v1 golden matrix", () => {
  it("normalizes NFD, accents and singular/plural", () => expect(normalizeIngredient("  Limónes ")).toBe("limon"));
  it.each([
    ["tomato", "tomato", "exact"], ["garlic", "ajo", "alias"], ["olive oil", "virgin olive oil", "substring"],
    ["red pepper flakes", "pepper powder", "keyword"], ["chikcen", "chicken", "fuzzy"],
  ])("uses deterministic strategy for %s", (recipeName, inventoryName, strategy) => expect(matchIngredient(recipeName, [{ id: "one", name: inventoryName }], vocabulary)?.strategy).toBe(strategy));
  it("lets a verified user mapping win without changing global aliases", () => {
    expect(matchIngredient("aubergine", [{ id: "one", name: "eggplant" }], vocabulary, [{ scannedName: "eggplant", normalizedName: "aubergine", verifiedByUser: true }])?.strategy).toBe("verified");
    expect(matchIngredient("aubergine", [{ id: "one", name: "eggplant" }], vocabulary)).toBeNull();
  });
  it("handles missing categories, empty inventory and stable external-id ties", () => {
    const recipes = ["b", "a"].map((externalId) => ({ id: externalId, externalId, name: externalId, ingredients: [{ name: "salt", category: null }] }));
    expect(suggestRecipes({ inventory: [], recipes })).toEqual([]);
    expect(suggestRecipes({ inventory: [{ id: "salt", name: "salt" }], recipes }).map((recipe) => recipe.id)).toEqual(["a", "b"]);
  });
});
