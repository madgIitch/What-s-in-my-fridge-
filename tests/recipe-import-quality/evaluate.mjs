// Offline evaluator: never calls production APIs or reserves quota.
// Inputs are local, human-annotated references and provider outputs.
import fs from "node:fs";
import path from "node:path";

export function wordErrorRate(reference, hypothesis) {
  const normalize = text => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const a = normalize(reference); const b = normalize(hypothesis);
  if (!a.length) return b.length ? null : 0;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length] / a.length;
}
const normalized = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export function measureRecipe(reference, actual) {
  if (reference.annotatedBy !== "human" || !Array.isArray(reference.ingredients) || !Array.isArray(reference.allowedNumericFacts)) throw new Error("HUMAN_REFERENCE_REQUIRED");
  const expected = reference.ingredients;
  const proposed = actual.ingredients ?? [];
  const pairs = proposed.map(item => ({ actual: item, expected: expected.find(e => [e.name, ...(e.aliases ?? [])].some(alias => normalized(alias) === normalized(item.name))) }));
  const truePositives = new Set(pairs.filter(p => p.expected).map(p => p.expected.name)).size;
  const explicit = expected.filter(e => e.amount !== undefined);
  const correctQuantities = explicit.filter(e => pairs.some(p => p.expected === e && normalized(p.actual.amount ?? "") === normalized(e.amount) && normalized(p.actual.unit ?? "") === normalized(e.unit ?? ""))).length;
  const unsupportedQuantities = pairs.filter(p => p.actual.amount !== undefined && (!p.expected || p.expected.amount === undefined || normalized(p.actual.amount) !== normalized(p.expected.amount))).length;
  const numericFacts = (actual.steps ?? []).flatMap(step => step.match(/\d+(?:[.,]\d+)?/g) ?? []);
  const unsupportedNumbers = numericFacts.filter(n => !reference.allowedNumericFacts.includes(n)).length;
  return { expectedIngredients: expected.length, proposedIngredients: proposed.length, truePositives, precision: proposed.length ? truePositives / proposed.length : 0, recall: expected.length ? truePositives / expected.length : 0, explicitQuantities: explicit.length, correctQuantities, quantityAccuracy: explicit.length ? correctQuantities / explicit.length : null, unsupportedQuantities, unsupportedNumbers, wer: typeof reference.transcript === "string" && typeof actual.transcript === "string" ? wordErrorRate(reference.transcript, actual.transcript) : null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"))) {
  const [referencePath, resultPath] = process.argv.slice(2);
  if (!referencePath || !resultPath) throw new Error("Usage: node evaluate.mjs <private-reference.json> <private-result.json>");
  console.log(JSON.stringify(measureRecipe(JSON.parse(fs.readFileSync(referencePath, "utf8")), JSON.parse(fs.readFileSync(resultPath, "utf8"))), null, 2));
}
