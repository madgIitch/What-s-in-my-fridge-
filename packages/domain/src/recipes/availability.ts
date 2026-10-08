import { evaluateTodayRecipe, normalizeTodayText, parseRecipeQuantity, type FoodConceptInput, type IngredientDecision, type TodayPantryItem, type TodayRecipeIngredient } from '../recommendations/today';

export type RecipeRef = { kind: 'catalog' | 'import'; id: string };
export type AvailabilityIngredient = {
  position: number; name: string; originalAmount: string | null; originalUnit: string | null;
  amount_status: 'exact' | 'unknown'; amount_value: number | null; amount_unit: string | null;
  conceptId: string | null; groupKey: string; decision: IngredientDecision['availability'];
};
export type CookRecipe = { recipeRef: RecipeRef; title: string; ingredients: (TodayRecipeIngredient & { originalAmount?: string | null; originalUnit?: string | null })[]; steps: string[]; sourceUrl: string | null; reviewRequired: boolean; provenance: unknown };

export function safeOriginalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}

export function recipeAvailability(recipe: CookRecipe, pantry: readonly TodayPantryItem[], concepts: readonly FoodConceptInput[], today: string) {
  const groups = new Map<string, { conceptId: string | null; ingredients: TodayRecipeIngredient[] }>();
  const byId = new Map(concepts.map(c => [c.id, c])); const byName = new Map<string, Set<string>>();
  for (const c of concepts) for (const name of [c.displayName, ...(c.aliases ?? [])]) { const key = normalizeTodayText(name); const ids = byName.get(key) ?? new Set<string>(); ids.add(c.id); byName.set(key, ids); }
  const rows = recipe.ingredients.map((ingredient, position) => {
    const candidates = byName.get(normalizeTodayText(ingredient.normalizedName || ingredient.name));
    const conceptId = ingredient.foodConceptId && byId.has(ingredient.foodConceptId) ? ingredient.foodConceptId : candidates?.size === 1 ? [...candidates][0] : null;
    const groupKey = conceptId ?? `unresolved:${position}`;
    const group = groups.get(groupKey) ?? { conceptId, ingredients: [] };
    group.ingredients.push({ ...ingredient, foodConceptId: conceptId }); groups.set(groupKey, group);
    const parsed = parseRecipeQuantity(ingredient.measure);
    return { position, name: ingredient.name, originalAmount: ingredient.originalAmount === undefined ? ingredient.measure ?? null : ingredient.originalAmount, originalUnit: ingredient.originalUnit ?? null, amount_status: parsed ? 'exact' : 'unknown', amount_value: parsed?.quantity ?? null, amount_unit: parsed?.unit ?? null, conceptId, groupKey } as Omit<AvailabilityIngredient, 'decision'>;
  });
  const decisions = new Map<string, IngredientDecision['availability']>();
  for (const [key, group] of groups) {
    const result = evaluateTodayRecipe({ recipe: { recipeId: recipe.recipeRef.id, name: recipe.title, ingredients: group.ingredients }, pantry, concepts: group.conceptId ? [byId.get(group.conceptId)!] : [], today });
    decisions.set(key, result.missingCount ? 'missing' : result.unknownCount ? 'unknown' : result.quantityToCheck ? 'have_presence_unknown_amount' : 'have_enough');
  }
  const decision = evaluateTodayRecipe({ recipe: { recipeId: recipe.recipeRef.id, name: recipe.title, ingredients: recipe.ingredients }, pantry, concepts, today });
  return { ...decision, haveCount: [...decisions.values()].filter(v => v === 'have_enough' || v === 'have_presence_unknown_amount').length, totalCount: groups.size, ingredients: rows.map(row => ({ ...row, decision: decisions.get(row.groupKey)! })) };
}
