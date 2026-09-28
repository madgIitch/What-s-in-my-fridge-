import type { Recipe } from "./contracts.js";

export const QUALITY_VERSION = "recipe-quality-v1";
export const PROMPT_VERSION = "recipe-evidence-v1";
export type Evidence = { id: string; kind: "manual" | "caption" | "subtitle" | "html" | "asr"; text: string; start?: number; end?: number };
export type EvidenceCandidate = {
  title: string;
  ingredients: { name: string; amount?: string; unit?: string; evidenceIds: string[] }[];
  steps: { text: string; evidenceIds: string[] }[];
};
const textSchema = { type: "string", minLength: 1, maxLength: 2000 };
const references = { type: "array", minItems: 1, maxItems: 20, items: { type: "string" } };
export const evidenceSchema = {
  type: "object", additionalProperties: false, required: ["title", "ingredients", "steps"],
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    ingredients: { type: "array", minItems: 1, maxItems: 200, items: { type: "object", additionalProperties: false, required: ["name", "evidenceIds"], properties: { name: textSchema, amount: textSchema, unit: textSchema, evidenceIds: references } } },
    steps: { type: "array", minItems: 1, maxItems: 100, items: { type: "object", additionalProperties: false, required: ["text", "evidenceIds"], properties: { text: textSchema, evidenceIds: references } } },
  },
};

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function refs(value: unknown): value is string[] { return Array.isArray(value) && value.length > 0 && value.length <= 20 && value.every(id => typeof id === "string" && id.length <= 100); }
function text(value: unknown, max = 2000): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= max; }
export function validCandidate(value: unknown): value is EvidenceCandidate {
  return record(value) && text(value.title, 200)
    && Array.isArray(value.ingredients) && value.ingredients.length > 0 && value.ingredients.length <= 200
    && value.ingredients.every(i => record(i) && text(i.name, 200) && refs(i.evidenceIds) && (i.amount === undefined || text(i.amount, 100)) && (i.unit === undefined || text(i.unit, 100)))
    && Array.isArray(value.steps) && value.steps.length > 0 && value.steps.length <= 100
    && value.steps.every(s => record(s) && text(s.text) && refs(s.evidenceIds));
}
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const cooking = /\b(?:anad\w*|agreg\w*|mezcl\w*|bat\w*|cort\w*|pic\w*|cocin\w*|horne\w*|fri\w*|sofri\w*|herv\w*|enroll\w*|dobl\w*|rellen\w*|unt\w*|ech\w*|coloc\w*|pon\w*|poned|ponga\w*|lav\w*|pel\w*|sazon\w*|serv\w*|calent\w*|dej\w*|retir\w*|remov\w*|asar|asa\w*|tostar|tost\w*|derret\w*|enfri\w*|repos\w*|repart\w*|escurr\w*)\b/;
export function hasRecipeCoverage(value: string) {
  const clean = normalize(value);
  const ingredient = /\b(?:ingredientes|\d+(?:[.,]\d+)?\s*(?:g|gr|kg|ml|l|huevos?|cucharadas?|tazas?)|huevos?|tomates?|queso|harina|aceite|tortillas?|cebolla|patatas?|sal|chicken|flour|eggs?)\b/;
  return clean.length >= 40 && ingredient.test(clean) && (cooking.test(clean) || /\b(?:mix|cook|bake|fry|add|boil|stir|cut)\b/.test(clean));
}
export function subtitleText(value: string) {
  return value.split(/\r?\n/).filter(line => line.trim() && !/^(?:WEBVTT|NOTE|Kind:|Language:|\d+$)/.test(line) && !line.includes("-->"))
    .map(line => line.replace(/<[^>]*>/g, "").trim()).filter((line, index, lines) => line !== lines[index - 1]).join(" ").slice(0, 100_000);
}
function numbers(value: string) { return normalize(value).match(/\d+(?:[.,]\d+)?/g)?.map(n => n.replace(",", ".")) ?? []; }
function words(value: string) { return normalize(value).match(/[a-z]{4,}/g) ?? []; }

// These checks detect unsupported fields; they are not a semantic accuracy score.
// Until the held-out benchmark passes, new results remain explicitly reviewable.
export function assessCandidate(candidate: EvidenceCandidate, evidence: Evidence[]) {
  const reasons = new Set<string>();
  const byId = new Map(evidence.map(item => [item.id, item]));
  function source(ids: string[]) {
    if (ids.some(id => !byId.has(id))) reasons.add("EVIDENCE_MISSING");
    return ids.map(id => byId.get(id)?.text ?? "").join("\n");
  }
  const seen = new Set<string>();
  const ingredients: Recipe["ingredients"] = [];
  for (const item of candidate.ingredients) {
    const supporting = source(item.evidenceIds);
    const key = normalize(item.name.trim());
    if (!words(item.name).some(word => normalize(supporting).includes(word))) { reasons.add("INGREDIENT_UNCERTAIN"); continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    const ingredient: Recipe["ingredients"][number] = { name: item.name.trim() };
    const amount = item.amount?.trim();
    if (!amount) reasons.add("QUANTITY_UNKNOWN");
    else if (numbers(amount).length && numbers(amount).every(n => numbers(supporting).includes(n))) {
      ingredient.amount = amount;
      if (item.unit && normalize(supporting).includes(normalize(item.unit))) ingredient.unit = item.unit.trim();
      else if (item.unit) reasons.add("UNIT_UNCERTAIN");
    } else { reasons.add("QUANTITY_UNKNOWN"); }
    ingredients.push(ingredient);
  }
  const steps: string[] = [];
  for (const step of candidate.steps) {
    const supporting = source(step.evidenceIds);
    if (!cooking.test(normalize(step.text))) { reasons.add("NON_COOKING_TEXT"); continue; }
    if (!numbers(step.text).every(n => numbers(supporting).includes(n))) { reasons.add("UNSUPPORTED_MEASURE"); continue; }
    if (!words(step.text).some(word => normalize(supporting).includes(word))) { reasons.add("STEP_UNCERTAIN"); continue; }
    steps.push(step.text.trim());
  }
  reasons.add("QUALITY_BENCHMARK_PENDING");
  return { ingredients, steps, quality: { version: QUALITY_VERSION, status: "review_required", reasons: [...reasons], pipelineVersion: QUALITY_VERSION, promptVersion: PROMPT_VERSION } };
}
