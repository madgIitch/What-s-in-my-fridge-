// Runtime code must stay inside the apps/web Turbopack root.
type ImportedRecipe = {
  schemaVersion: "recipe-v1";
  title: string;
  ingredients: { name: string; amount?: string; unit?: string }[];
  steps: string[];
};

export function validateImportedRecipe(value: unknown): value is ImportedRecipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const recipe = value as Partial<ImportedRecipe>;
  return recipe.schemaVersion === "recipe-v1"
    && typeof recipe.title === "string" && recipe.title.trim().length > 0 && recipe.title.length <= 200
    && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && recipe.ingredients.length <= 200
    && recipe.ingredients.every(ingredient => ingredient && typeof ingredient.name === "string" && ingredient.name.trim().length > 0
      && (ingredient.amount === undefined || typeof ingredient.amount === "string")
      && (ingredient.unit === undefined || typeof ingredient.unit === "string"))
    && Array.isArray(recipe.steps) && recipe.steps.length > 0 && recipe.steps.length <= 100
    && recipe.steps.every(step => typeof step === "string" && step.trim().length > 0);
}
