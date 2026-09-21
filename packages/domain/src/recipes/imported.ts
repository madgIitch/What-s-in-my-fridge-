import type { RecipeProvenance } from "../recipe-jobs/index";

export interface ImportedRecipeIngredient { name: string; amount?: string; unit?: string }
export interface ImportedRecipe {
  schemaVersion: "recipe-v1";
  title: string;
  ingredients: ImportedRecipeIngredient[];
  steps: string[];
  source: { type: RecipeProvenance["sourceType"]; url?: string };
  provenance: RecipeProvenance;
}

export const importedRecipeJsonSchema = {
  $id: "https://neverita.app/schemas/recipe-v1.json",
  type: "object",
  required: ["schemaVersion", "title", "ingredients", "steps", "source", "provenance"],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: "recipe-v1" },
    title: { type: "string", minLength: 1, maxLength: 200 },
    ingredients: { type: "array", minItems: 1, maxItems: 200, items: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1 }, amount: { type: "string" }, unit: { type: "string" } } } },
    steps: { type: "array", minItems: 1, maxItems: 100, items: { type: "string", minLength: 1 } },
    source: { type: "object" }, provenance: { type: "object" },
  },
} as const;

export function validateImportedRecipe(value: unknown): value is ImportedRecipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Partial<ImportedRecipe>;
  return v.schemaVersion === "recipe-v1" && typeof v.title === "string" && v.title.trim().length > 0 && v.title.length <= 200
    && Array.isArray(v.ingredients) && v.ingredients.length > 0 && v.ingredients.length <= 200 && v.ingredients.every((i) => i && typeof i.name === "string" && i.name.trim().length > 0)
    && Array.isArray(v.steps) && v.steps.length > 0 && v.steps.length <= 100 && v.steps.every((s) => typeof s === "string" && s.trim().length > 0)
    && !!v.source && typeof v.source.type === "string" && !!v.provenance && typeof v.provenance.sourceType === "string";
}
