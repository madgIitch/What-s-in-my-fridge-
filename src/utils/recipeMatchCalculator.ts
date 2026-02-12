import FoodItem from '../database/models/FoodItem';
import { RecipeUi } from '../database/models/RecipeCache';

export interface RecipeMatchResult {
  matchPercentage: number;
  matchedIngredients: string[];
  missingIngredients: string[];
}

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Recalculate recipe match against current inventory.
 */
export const calculateRecipeMatch = (
  recipe: RecipeUi,
  inventoryItems: FoodItem[]
): RecipeMatchResult => {
  const inventoryNames = inventoryItems
    .map((item) => normalizeText(item.normalizedName || item.name))
    .filter((name) => name !== '');

  const matched: string[] = [];
  const missing: string[] = [];

  const ingredients = Array.isArray(recipe.ingredientsWithMeasures)
    ? recipe.ingredientsWithMeasures
    : [];

  for (const ingredient of ingredients) {
    const normalizedIngredient = normalizeText(ingredient);
    const isInInventory = inventoryNames.some(
      (inv) =>
        normalizedIngredient.includes(inv) ||
        inv.includes(normalizedIngredient)
    );

    if (isInInventory) {
      matched.push(ingredient);
    } else {
      missing.push(ingredient);
    }
  }

  const total = matched.length + missing.length;
  return {
    matchPercentage: total > 0 ? Math.round((matched.length / total) * 100) : 0,
    matchedIngredients: matched,
    missingIngredients: missing,
  };
};
