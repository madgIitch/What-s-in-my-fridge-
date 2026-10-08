import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { recipeAvailability, safeOriginalUrl, type CookRecipe } from '../../../../../packages/domain/src/recipes/availability';
import { rankTodayDecisions, type FoodConceptInput, type TodayPantryItem } from '../../../../../packages/domain/src/recommendations/today';
import { uuid, type CookAvailability, type CookLibrary, type LibraryItem, type RecipeRef } from './contracts';

export type CookDb = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
type Row = { id: string; name: string; food_concept_id: string | null; commercial_product_id: string | null; deleted_at: string | null; normalization_status: 'unknown' | 'proposed' | 'confirmed'; stock_mode: string; stock_state: string | null; quantity_exact: number | null; quantity_unit: string | null; freshness_precision: string; freshness_source: string | null; expiry_date_exact: string | null; acquired_on: string | null; freshness_estimated_days: number | null };
type VersionedRecipe = CookRecipe & { recipeVersion: string; invalid?: boolean };
type Context = { recipe: VersionedRecipe; stateKey: string; date: string; cached?: CookAvailability; pantry: Row[]; concepts: FoodConceptInput[] };
type LibraryContext = Omit<Context, 'recipe' | 'stateKey'> & { catalog: VersionedRecipe[]; jobs: { id: string; state: string; sourceType: string; errorCode: string; retryable: boolean; recipe: VersionedRecipe | null }[]; saved: { id: string; recipeId: string; snapshot: { title: string; reviewRequired?: boolean }; savedAt: string }[]; catalogMissing: boolean };
export class CookFault extends Error { constructor(public code: string) { super(code); } }
export async function rpc<T>(db: CookDb, name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error || !data) throw new CookFault('COOK_UNAVAILABLE');
  if (typeof data === 'object' && 'error' in data) throw new CookFault(String((data as { error: string }).error));
  return data as T;
}
function pantry(rows: Row[]): TodayPantryItem[] {
  return rows.map(row => ({ id: row.id, displayName: row.name, foodConceptId: row.food_concept_id, commercialProductId: row.commercial_product_id, deletedAt: row.deleted_at, normalizationStatus: row.normalization_status,
    stock: row.stock_mode === 'exact' ? { mode: 'exact', quantityPrecision: 'exact', quantity: Number(row.quantity_exact), unit: row.quantity_unit ?? '', state: row.stock_state as 'plenty' | 'some' | 'low' | 'empty' | undefined }
      : row.stock_mode === 'qualitative' ? { mode: 'qualitative', quantityPrecision: 'unknown', state: (row.stock_state ?? 'empty') as 'plenty' | 'some' | 'low' | 'empty' }
      : { mode: 'presence', quantityPrecision: 'unknown', state: (row.stock_state ?? 'unknown') as 'present' | 'absent' | 'unknown' },
    freshness: row.freshness_precision === 'exact' && row.expiry_date_exact && ['package', 'user', 'retailer'].includes(row.freshness_source ?? '')
      ? { precision: 'exact', expiryDateExact: row.expiry_date_exact, source: row.freshness_source as 'package' | 'user' | 'retailer' }
      : row.freshness_precision === 'estimated' && row.freshness_estimated_days && row.freshness_source
        ? { precision: 'estimated', source: row.freshness_source as 'package' | 'user' | 'retailer' | 'receipt' | 'catalog', acquiredOn: row.acquired_on ?? undefined, windowDays: row.freshness_estimated_days }
        : { precision: 'unknown' } }));
}
function projection(recipe: VersionedRecipe, context: Pick<Context, 'pantry' | 'concepts' | 'date'>, decision?: ReturnType<typeof recipeAvailability>): CookAvailability {
  const result = decision ?? recipeAvailability(recipe, pantry(context.pantry), context.concepts, context.date);
  return { contract: 'recipe-availability-v1', recipeRef: recipe.recipeRef, recipeVersion: recipe.recipeVersion, snapshotKey: '', computedAt: new Date().toISOString(), expiresAt: '', title: recipe.title, steps: recipe.steps, sourceUrl: safeOriginalUrl(recipe.sourceUrl), reviewRequired: recipe.reviewRequired, availability: result.availability, haveCount: result.haveCount, totalCount: result.totalCount, missingCount: result.missingCount, unknownCount: result.unknownCount, quantityToCheck: result.quantityToCheck, ingredients: result.ingredients };
}
export async function availability(db: CookDb, userId: string, ref: RecipeRef): Promise<CookAvailability> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const context = await rpc<Context>(db, 'read_cook_context_v1', { p_kind: ref.kind, p_id: ref.id });
    if (context.cached) return context.cached;
    const response = projection(context.recipe, context);
    try { return await rpc<CookAvailability>(createAdminSupabaseClient() as unknown as CookDb, 'store_cook_cache_v1', { p_uid: userId, p_kind: ref.kind, p_id: ref.id, p_state_key: context.stateKey, p_version: context.recipe.recipeVersion, p_result: response }); }
    catch (error) { if (!(error instanceof CookFault) || error.code !== 'SNAPSHOT_CONFLICT') throw error; }
  }
  throw new CookFault('SNAPSHOT_CONFLICT');
}
export function recipeHref(ref: RecipeRef) { return ref.kind === 'import' ? `/app/recipes/import/${ref.id}` : `/app/recipes/${ref.id}`; }
export async function library(db: CookDb, userId: string, view: string, limit: number, cursor: string | null): Promise<CookLibrary> {
  const context = await rpc<LibraryContext>(db, 'read_cook_library_v1');
  const savedIds = new Set(context.saved.map(f => f.recipeId));
  let items: LibraryItem[];
  if (view === 'imported') items = context.jobs.map(job => ({ recipeRef: { kind: 'import', id: job.id }, title: job.recipe?.title ?? `Receta de ${job.sourceType}`, href: `/app/recipes/import/${job.id}`, state: job.recipe?.invalid ? 'invalid' : job.state, errorCode: job.errorCode, retryable: job.retryable, reviewRequired: job.recipe?.reviewRequired }));
  else if (view === 'saved') items = context.saved.flatMap(f => {
    const kind = f.recipeId.startsWith('import:') ? 'import' : 'catalog'; const id = kind === 'import' ? f.recipeId.slice(7) : f.recipeId;
    if (!uuid(id)) return [{ recipeRef: { kind, id: f.id }, title: f.snapshot.title, href: '/app/favorites', state: 'saved', saved: true, reviewRequired: f.snapshot.reviewRequired }];
    const ref: RecipeRef = { kind, id }; return [{ recipeRef: ref, title: f.snapshot.title, href: `${recipeHref(ref)}?saved=${f.id}`, state: 'saved', saved: true, reviewRequired: f.snapshot.reviewRequired }];
  });
  else {
    const recipes = [...context.catalog, ...context.jobs.flatMap(j => j.state === 'completed' && j.recipe && !j.recipe.invalid ? [j.recipe] : [])].filter(r => r && !r.invalid);
    const stock = pantry(context.pantry);
    const projected = recipes.map(r => { const d = recipeAvailability(r, stock, context.concepts, context.date); return { r, a: projection(r, context, d), d }; });
    const byKey = new Map(projected.map(p => [`${p.r.recipeRef.kind}:${p.r.recipeRef.id}`, p]));
    const ranked = rankTodayDecisions(projected.map(p => ({ ...p.d, recipeId: `${p.r.recipeRef.kind}:${p.r.recipeRef.id}`, reasons: [...p.d.reasons, ...(savedIds.has(p.r.recipeRef.kind === 'catalog' ? p.r.recipeRef.id : `import:${p.r.recipeRef.id}`) ? [{ code: 'favorite' as const }] : [])] })));
    items = ranked.map(d => { const p = byKey.get(d.recipeId)!; return { recipeRef: p.r.recipeRef, title: p.r.title, href: recipeHref(p.r.recipeRef), state: 'completed', reviewRequired: p.r.reviewRequired, availability: p.a }; });
  }
  const version = createHash('sha256').update(JSON.stringify({ userId, view, context })).digest('hex');
  let offset = 0;
  if (cursor) {
    try { const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as { version: string; offset: number }; if (parsed.version !== version || !Number.isSafeInteger(parsed.offset) || parsed.offset < 0 || parsed.offset > items.length) throw new Error(); offset = parsed.offset; }
    catch { throw new CookFault('CURSOR_INVALID'); }
  }
  const next = offset + limit;
  return { contract: 'cook-library-v1', items: items.slice(offset, next), nextCursor: next < items.length ? Buffer.from(JSON.stringify({ version, offset: next })).toString('base64url') : null, catalogMissing: context.catalogMissing, computedAt: new Date().toISOString() };
}
