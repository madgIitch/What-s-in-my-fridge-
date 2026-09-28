import test from "node:test";
import assert from "node:assert/strict";
import { measureRecipe, wordErrorRate } from "./evaluate.mjs";
test("WER measures substitutions and does not report a missing reference as success", () => {
  assert.equal(wordErrorRate("corta la tortilla", "corta la ensalada"), 1 / 3);
  assert.equal(wordErrorRate("", "corta"), null);
});
test("unknown quantities cannot be counted as accurate inferred values", () => {
  const result = measureRecipe({ annotatedBy: "human", ingredients: [{ name: "Queso" }], allowedNumericFacts: [] }, { ingredients: [{ name: "Queso", amount: "100", unit: "g" }], steps: ["Cocina 15 minutos"] });
  assert.equal(result.unsupportedQuantities, 1);
  assert.equal(result.unsupportedNumbers, 1);
  assert.equal(result.quantityAccuracy, null);
});
test("provider outputs cannot masquerade as human reference", () => {
  assert.throws(() => measureRecipe({ annotatedBy: "model", ingredients: [], allowedNumericFacts: [] }, {}), /HUMAN_REFERENCE_REQUIRED/);
});
