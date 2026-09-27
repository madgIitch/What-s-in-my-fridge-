import { describe, expect, it } from "vitest";
import { validateImportedRecipe } from "./result";

const recipe = { schemaVersion: "recipe-v1", title: "Tortilla", ingredients: [{ name: "Huevo", amount: "2", unit: "unidades" }], steps: ["Batir los huevos."] };

describe("imported recipe display validation", () => {
  it("accepts a stored recipe and optional ingredient measures", () => {
    expect(validateImportedRecipe(recipe)).toBe(true);
    expect(validateImportedRecipe({ ...recipe, ingredients: [{ name: "Sal" }] })).toBe(true);
  });
  it("rejects missing results, empty steps and unsafe ingredient values", () => {
    expect(validateImportedRecipe(null)).toBe(false);
    expect(validateImportedRecipe({ ...recipe, steps: [] })).toBe(false);
    expect(validateImportedRecipe({ ...recipe, ingredients: [{ name: "Huevo", amount: {} }] })).toBe(false);
    expect(validateImportedRecipe({ ...recipe, schemaVersion: "recipe-v2" })).toBe(false);
  });
});
