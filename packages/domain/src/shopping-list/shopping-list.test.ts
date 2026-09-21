import { describe, expect, it } from "vitest";
import { aggregateShoppingLines, missingFromSnapshot } from "./index";
describe("shopping lines", () => {
  it("aggregates only compatible units", () => expect(aggregateShoppingLines([
    { ingredientKey: "flour", name: "Flour", quantity: 2, unit: "g" }, { ingredientKey: "flour", name: "Flour", quantity: 3, unit: "g" },
    { ingredientKey: "flour", name: "Flour", quantity: 1, unit: "kg" },
  ])).toHaveLength(2));
  it("calculates current missing amount", () => expect(missingFromSnapshot([{ ingredientKey: "x", name: "X", quantity: 3, unit: "g" }], new Map([["x", 1]]))[0].quantity).toBe(2));
});
