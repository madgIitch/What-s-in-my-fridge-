import { describe, expect, it } from "vitest";
import { validateRecipeSnapshot } from "./index";
describe("favorite snapshots", () => {
  it("validates and copies a complete snapshot", () => {
    const source = { version: 1 as const, title: " Sopa ", ingredients: [{ ingredientKey: "tomato", name: " Tomate ", quantity: 2, unit: "ud" }], instructions: ["Cortar"] };
    const snapshot = validateRecipeSnapshot(source); source.title = "Changed";
    expect(snapshot.title).toBe("Sopa"); expect(snapshot.ingredients[0].name).toBe("Tomate");
  });
  it("rejects negative quantities", () => expect(() => validateRecipeSnapshot({ version: 1, title: "x", ingredients: [{ name: "x", quantity: -1 }], instructions: [] })).toThrow());
});

