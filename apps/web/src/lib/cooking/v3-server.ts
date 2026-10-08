import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { productV3Enabled } from '@/app/(auth)/app/product-v3';
import { buildCookingPlan, type CookingLot } from '../../../../../packages/domain/src/cooking/plan';
import type { CookRecipe } from '../../../../../packages/domain/src/recipes/availability';
import type { FoodConceptInput } from '../../../../../packages/domain/src/recommendations/today';
import { cookingError, privateHeaders, type CookingSource } from './v3-contracts';
type Db = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export class CookingFault extends Error { constructor(public code: string) { super(code); } }
export async function cookingRpc(db: Db, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, args); if (error || !data) throw new CookingFault('COOK_UNAVAILABLE');
  if (typeof data === 'object' && 'error' in data) throw new CookingFault(String((data as { error: unknown }).error)); return data;
}
export async function cookingPlan(db: Db, userId: string, source: CookingSource) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctx = await cookingRpc(db, 'read_cooking_v3_context', { p_kind: source.kind, p_id: source.id }) as { recipe: CookRecipe & { recipeVersion: string }; pantry: CookingLot[]; concepts: FoodConceptInput[]; stateKey: string };
    const result = { contract: 'cooking-plan-v1', sourceRef: source, recipeVersion: ctx.recipe.recipeVersion, recipe: ctx.recipe, lines: buildCookingPlan(ctx.recipe, ctx.pantry, ctx.concepts) };
    try { return await cookingRpc(createAdminSupabaseClient() as unknown as Db, 'store_cooking_v3_plan', { p_uid: userId, p_kind: source.kind, p_id: source.id, p_state: ctx.stateKey, p_result: result }); }
    catch (error) { if (!(error instanceof CookingFault) || error.code !== 'PANTRY_CONFLICT') throw error; }
  }
  throw new CookingFault('PANTRY_CONFLICT');
}
export async function cookingRoute(work: (db: Db, uid: string) => Promise<unknown>) {
  if (!productV3Enabled()) return new Response(null, { status: 404 });
  try {
    const s = await createServerSupabaseClient(); const { data: { user } } = await s.auth.getUser();
    if (!user) return cookingError('AUTH_REQUIRED');
    const result = await work(s as unknown as Db, user.id);
    const { data: { user: current } } = await s.auth.getUser(); if (!current || current.id !== user.id) return cookingError('AUTH_REQUIRED');
    return Response.json(result, { headers: privateHeaders });
  } catch (e) { return cookingError(e instanceof CookingFault ? e.code : 'COOK_UNAVAILABLE'); }
}
