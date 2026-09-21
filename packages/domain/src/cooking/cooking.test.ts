import { describe, expect, it } from "vitest";
import { buildFefoPlan } from "./index";
describe("FEFO cooking plan", () => {
  it("uses earliest lots and never exceeds stock", () => expect(buildFefoPlan([{ ingredientKey: "x", name: "X", quantity: 3, unit: "g" }], [
    { id: "b", ingredientKey: "x", quantity: 2, unit: "g", version: 1, expiryDate: "2026-02-01", createdAt: "2026-01-01" },
    { id: "a", ingredientKey: "x", quantity: 2, unit: "g", version: 1, expiryDate: "2026-01-01", createdAt: "2026-01-01" },
  ]).map((x) => [x.inventoryItemId, x.quantity])).toEqual([["a", 2], ["b", 1]]));
  it("rejects insufficient stock", () => expect(() => buildFefoPlan([{ ingredientKey: "x", name: "X", quantity: 1, unit: "g" }], [])).toThrow("INSUFFICIENT_QUANTITY"));
});

