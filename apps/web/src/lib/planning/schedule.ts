import { listMeals, listMutations, queueMutation } from '@/lib/meal-calendar/db';
import { pullAllMeals, syncMealOutbox } from '@/lib/meal-calendar/sync';
import type { MealEntry, MealMutation, MealPayload } from '@/lib/meal-calendar/types';
import { OUTSIDE_TITLE, PLAN_MEAL_TYPE, canSchedule, recipesToRetire, type PlanEntry } from '../../../../../packages/domain/src/planning/week';

export type PlannableRecipe = {
  kind: 'catalog' | 'import'; id: string; title: string;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
};
export const recipeRefOf = (recipe: Pick<PlannableRecipe, 'kind' | 'id'>) => recipe.kind === 'import' ? `import:${recipe.id}` : recipe.id;

/** Cached rows plus the intentions still queued, so the plan never shows an intention as already applied. */
export function applyPending(rows: readonly MealEntry[], pending: readonly MealMutation[], userId: string, now = new Date().toISOString()): MealEntry[] {
  let current = [...rows];
  for (const m of pending) {
    if (m.state === 'rejected') continue;
    if (m.operation === 'delete') { current = current.filter(r => r.id !== m.mealEntryId); continue; }
    if (!m.payload) continue;
    const base = current.find(r => r.id === m.mealEntryId);
    const outside = !m.payload.recipe_snapshot && m.payload.meal_type === PLAN_MEAL_TYPE && m.payload.custom_name === OUTSIDE_TITLE;
    const next = { ...(base ?? { id: m.mealEntryId, user_id: userId, version: 0, created_at: now, updated_at: now, deleted_at: null }), ...m.payload,
      plan_kind: outside ? 'outside' : 'meal' } as MealEntry;
    current = [...current.filter(r => r.id !== m.mealEntryId), next];
  }
  return current;
}

export async function loadPlanRows(userId: string): Promise<MealEntry[]> {
  const rows = (await listMeals(userId)) as MealEntry[];
  return applyPending(rows.filter(r => !r.deleted_at), await listMutations(userId), userId);
}
export async function refreshPlanRows(userId: string, onExpired?: () => void): Promise<MealEntry[]> {
  if (navigator.onLine) {
    await syncMealOutbox(userId, onExpired);
    await pullAllMeals(userId);
  }
  return loadPlanRows(userId);
}

const emptyPayload = (): Pick<MealPayload, 'custom_name' | 'ingredients_consumed' | 'notes' | 'calories_estimate' | 'consumed_at'> =>
  ({ custom_name: null, ingredients_consumed: [], notes: null, calories_estimate: null, consumed_at: null });
function recipePayload(recipe: PlannableRecipe, date: string): MealPayload {
  return {
    ...emptyPayload(), meal_type: PLAN_MEAL_TYPE, meal_date: date, recipe_id: recipe.kind === 'catalog' ? recipe.id : null,
    recipe_snapshot: {
      version: 1, recipe_id: recipeRefOf(recipe), title: recipe.title, instructions: [],
      ingredients: recipe.ingredients.slice(0, 200).map(i => ({ ingredient_key: null, name: i.name, quantity: i.quantity, unit: i.unit })),
    },
  };
}
const queue = (userId: string, operation: 'create' | 'update' | 'delete', mealEntryId: string, expectedVersion: number | null, payload: MealPayload | null) =>
  queueMutation({ clientMutationId: crypto.randomUUID(), userId, operation, mealEntryId, expectedVersion, payload, state: 'pending', createdAt: new Date().toISOString() });

export type ScheduleResult = { ok: true; entryId: string; date: string } | { ok: false; reason: string };
export async function scheduleRecipe(userId: string, recipe: PlannableRecipe, date: string, today: string): Promise<ScheduleResult> {
  let rows: MealEntry[];
  try { rows = await refreshPlanRows(userId); } catch { rows = await loadPlanRows(userId); }
  const decision = canSchedule(rows as unknown as PlanEntry[], date, today, recipeRefOf(recipe));
  if (!decision.ok) return { ok: false, reason: decision.reason };
  const entryId = crypto.randomUUID();
  await queue(userId, 'create', entryId, null, recipePayload(recipe, date));
  if (navigator.onLine) await syncMealOutbox(userId);
  return { ok: true, entryId, date };
}
/** Sin decidir is the absence of an entry: removing is a soft delete that the server keeps for undo. */
export async function removeEntry(userId: string, entry: Pick<MealEntry, 'id' | 'version'>) {
  await queue(userId, 'delete', entry.id, entry.version, null);
  if (navigator.onLine) await syncMealOutbox(userId);
}
export async function setOutside(userId: string, date: string, rows: readonly MealEntry[]) {
  for (const retired of recipesToRetire(rows as unknown as PlanEntry[], date)) {
    const row = rows.find(r => r.id === retired.id)!;
    await queue(userId, 'delete', row.id, row.version, null);
  }
  // The key is omitted on purpose: a JSON null would be stored as jsonb 'null' and break the identity check.
  const outside = { ...emptyPayload(), meal_type: PLAN_MEAL_TYPE, meal_date: date, recipe_id: null, custom_name: OUTSIDE_TITLE } as unknown as MealPayload;
  await queue(userId, 'create', crypto.randomUUID(), null, outside);
  if (navigator.onLine) await syncMealOutbox(userId);
}
