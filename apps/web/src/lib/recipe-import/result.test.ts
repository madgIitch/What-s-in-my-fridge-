import { describe, expect, it } from "vitest";
import { recipeNeedsReview, recipeSourceUrl, validateImportedRecipe } from "./result";

const recipe = { schemaVersion: "recipe-v1", title: "Tortilla", ingredients: [{ name: "Huevo", amount: "2", unit: "unidades" }], steps: ["Batir los huevos."] };

describe("imported recipe display validation", () => {
  it("keeps old recipes readable without inventing quality and only links web sources", () => {
    expect(recipeNeedsReview(recipe)).toBe(false);
    expect(recipeNeedsReview({ ...recipe, provenance: { quality: { status: "review_required" } } })).toBe(true);
    expect(recipeSourceUrl({ source: { url: "javascript:alert(1)" } })).toBeNull();
    expect(recipeSourceUrl({ source: { url: "https://example.com/recipe" } })).toBe("https://example.com/recipe");
  });
  it("accepts a stored recipe and optional ingredient measures", () => {
    expect(validateImportedRecipe(recipe)).toBe(true);
    expect(validateImportedRecipe({ ...recipe, ingredients: [{ name: "Sal" }] })).toBe(true);
    expect(validateImportedRecipe({ ...recipe, ingredients: [{ name: "Sal", amount: null, unit: null }] })).toBe(true);
  });
  it("rejects missing results, empty steps and unsafe ingredient values", () => {
    expect(validateImportedRecipe(null)).toBe(false);
    expect(validateImportedRecipe({ ...recipe, steps: [] })).toBe(false);
    expect(validateImportedRecipe({ ...recipe, ingredients: [{ name: "Huevo", amount: {} }] })).toBe(false);
    expect(validateImportedRecipe({ ...recipe, schemaVersion: "recipe-v2" })).toBe(false);
  });
});
