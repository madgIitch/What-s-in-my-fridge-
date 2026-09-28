// Runtime code must stay inside the apps/web Turbopack root.
type ImportedRecipe = {
  schemaVersion: "recipe-v1";
  title: string;
  ingredients: { name: string; amount?: string | null; unit?: string | null }[];
  steps: string[];
  source?: { url?: string };
  provenance?: { quality?: { status?: string; reasons?: string[] } };
};

export function recipeNeedsReview(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const recipe = value as ImportedRecipe;
  return recipe.provenance?.quality?.status === "review_required";
}

export function recipeSourceUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const source = (value as ImportedRecipe).source?.url;
  if (typeof source !== "string") return null;
  try { const url = new URL(source); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}

export function validateImportedRecipe(value: unknown): value is ImportedRecipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const recipe = value as Partial<ImportedRecipe>;
  return recipe.schemaVersion === "recipe-v1"
    && typeof recipe.title === "string" && recipe.title.trim().length > 0 && recipe.title.length <= 200
    && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && recipe.ingredients.length <= 200
    && recipe.ingredients.every(ingredient => ingredient && typeof ingredient.name === "string" && ingredient.name.trim().length > 0
      && (ingredient.amount == null || typeof ingredient.amount === "string")
      && (ingredient.unit == null || typeof ingredient.unit === "string"))
    && Array.isArray(recipe.steps) && recipe.steps.length > 0 && recipe.steps.length <= 100
    && recipe.steps.every(step => typeof step === "string" && step.trim().length > 0);
}
