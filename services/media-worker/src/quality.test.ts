import test from "node:test";
import assert from "node:assert/strict";
import { assessCandidate, hasRecipeCoverage, subtitleText, validCandidate } from "./quality.js";

test("subtitle transport markup does not leak into recipe evidence", () => {
  assert.equal(subtitleText("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<c>Añade queso.</c>\nAñade queso.\n"), "Añade queso.");
});

test("promotion length does not prove recipe coverage", () => {
  assert.equal(hasRecipeCoverage("Sígueme y comparte esta publicación con todos tus amigos. ".repeat(20)), false);
  assert.equal(hasRecipeCoverage("Ingredientes: 2 huevos y sal. Bate los huevos y cocina en una sartén."), true);
});
test("unknown measures and unrelated dialogue do not become recipe facts", () => {
  const result = assessCandidate({ title: "Tortilla", ingredients: [{ name: "Queso", amount: "Por casa", unit: "cantidad suficiente", evidenceIds: ["caption"] }], steps: [{ text: "Parecéis que estáis a punto de prohibir algo.", evidenceIds: ["caption"] }, { text: "Añade queso y enrolla las tortillas.", evidenceIds: ["caption"] }] }, [{ id: "caption", kind: "caption", text: "Añade queso y enrolla las tortillas." }]);
  assert.deepEqual(result.ingredients, [{ name: "Queso" }]);
  assert.deepEqual(result.steps, ["Añade queso y enrolla las tortillas."]);
  assert.equal(result.quality.status, "review_required");
  assert.ok(result.quality.reasons.includes("QUANTITY_UNKNOWN"));
});
test("invented numeric instructions are removed and flagged", () => {
  const result = assessCandidate({ title: "Tortilla", ingredients: [{ name: "Huevos", amount: "2", evidenceIds: ["s"] }], steps: [{ text: "Cocina los huevos durante 15 minutos.", evidenceIds: ["s"] }] }, [{ id: "s", kind: "manual", text: "Bate 2 huevos y cocina en una sartén." }]);
  assert.equal(result.steps.length, 0);
  assert.ok(result.quality.reasons.includes("UNSUPPORTED_MEASURE"));
});
test("structured extraction requires evidence IDs and bounded values", () => {
  assert.equal(validCandidate({ title: "Tortilla", ingredients: [{ name: "Huevos" }], steps: ["Batir"] }), false);
  assert.equal(validCandidate({ title: "Tortilla", ingredients: [{ name: "Huevos", evidenceIds: ["s"] }], steps: [{ text: "Batir", evidenceIds: ["s"] }] }), true);
});
