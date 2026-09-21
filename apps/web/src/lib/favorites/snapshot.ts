import type { RecipeSnapshot, SnapshotIngredient } from "./types";

const amountPattern = /^\s*(?:(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|ud|unidad(?:es)?))?\s*(.+?)\s*$/i;
export function snapshotFromRecipe(recipe: { name: string; ingredientsWithMeasures: string[]; instructions: string }): RecipeSnapshot {
  const ingredients: SnapshotIngredient[] = recipe.ingredientsWithMeasures.map((raw) => {
    const match = raw.match(amountPattern); const name = (match?.[3] ?? raw).trim();
    return { ingredientKey: normalizeKey(name), name, quantity: match?.[1] ? Number(match[1].replace(",", ".")) : null, unit: match?.[2]?.toLocaleLowerCase("es") ?? null };
  });
  return { version: 1, title: recipe.name.trim(), ingredients, instructions: recipe.instructions.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) };
}
export function normalizeKey(value: string) { return value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

