import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  TODAY_CONTRACT, TODAY_RECOMMENDATION_VERSION, evaluateTodayRecipe, normalizeTodayText, selectTodayDecisions,
  type FoodConceptInput, type TodayPantryItem, type TodayRecipeInput,
} from "../../../../../packages/domain/src/recommendations/today";
import type { TodayRecipe, TodayResponse, TodayState } from "./contracts";

type Result = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Query = Result & {
  select(columns?: string): Query; eq(column: string, value: unknown): Query; in(column: string, values: string[]): Query;
  is(column: string, value: null): Query; order(column: string, options?: { ascending?: boolean }): Query; limit(value: number): Query;
};
export type TodayDb = { from(table: string): Query; rpc(name: string, args: Record<string, unknown>): Result };
type TodayAdminDb = { rpc(name: string, args: Record<string, unknown>): Result };
type CatalogRow = { id: string; matcher_version: string };
type PantryRow = {
  id: string; name: string; food_concept_id: string | null; commercial_product_id: string | null; deleted_at: string | null;
  normalization_status: "unknown" | "proposed" | "confirmed"; stock_mode: "presence" | "qualitative" | "exact";
  stock_state: "present" | "absent" | "plenty" | "some" | "low" | "empty" | null; quantity_precision: "unknown" | "exact";
  quantity_exact: number | null; quantity_unit: string | null; freshness_precision: "unknown" | "estimated" | "exact";
  freshness_source: "package" | "user" | "retailer" | "receipt" | "catalog" | null; acquired_on: string | null;
  freshness_estimated_days: number | null; expiry_date_exact: string | null; knowledge_provenance: "legacy" | "user" | "receipt" | "retailer" | "package" | null;
};
type ConceptRow = { id: string; display_name: string; food_concept_aliases: Array<{ normalized_alias: string }> };
type RecipeRow = { id: string; name: string; recipe_ingredients: Array<{ name: string; normalized_name: string | null; measure: string | null; food_concept_id: string | null; position: number }> };

function activePantry(row: PantryRow) {
  if (row.deleted_at) return false;
  // An existing item with unknown presence still needs review; it is not an
  // empty pantry and must not trigger new-account onboarding.
  if (row.stock_mode === "presence") return row.stock_state !== "absent";
  if (row.stock_mode === "qualitative") return row.stock_state !== "empty";
  return Number(row.quantity_exact) > 0 && row.stock_state !== "empty";
}

function pantryKnowledge(row: PantryRow): TodayPantryItem {
  const stock = row.stock_mode === "exact"
    ? { mode: "exact" as const, quantityPrecision: "exact" as const, quantity: Number(row.quantity_exact), unit: row.quantity_unit ?? "", ...(row.stock_state ? { state: row.stock_state as "plenty" | "some" | "low" | "empty" } : {}) }
    : row.stock_mode === "qualitative"
      ? { mode: "qualitative" as const, quantityPrecision: "unknown" as const, state: (row.stock_state ?? "empty") as "plenty" | "some" | "low" | "empty" }
      : { mode: "presence" as const, quantityPrecision: "unknown" as const, state: (row.stock_state ?? "unknown") as "present" | "absent" | "unknown" };
  const freshness = row.freshness_precision === "exact" && row.expiry_date_exact && row.freshness_source && ["package", "user", "retailer"].includes(row.freshness_source)
    ? { precision: "exact" as const, expiryDateExact: row.expiry_date_exact, source: row.freshness_source as "package" | "user" | "retailer" }
    : row.freshness_precision === "estimated" && row.freshness_source && row.freshness_estimated_days !== null
      ? { precision: "estimated" as const, source: row.freshness_source, ...(row.acquired_on ? { acquiredOn: row.acquired_on } : {}), windowDays: row.freshness_estimated_days }
      : { precision: "unknown" as const };
  return {
    id: row.id, foodConceptId: row.food_concept_id, commercialProductId: row.commercial_product_id, displayName: row.name,
    stock, freshness, deletedAt: row.deleted_at, normalizationStatus: row.normalization_status,
    knowledgeProvenance: row.knowledge_provenance ?? undefined,
  };
}

function publicRecipe(decision: ReturnType<typeof evaluateTodayRecipe>): TodayRecipe {
  return {
    recipeId: decision.recipeId, name: decision.name, availability: decision.availability,
    missingCount: decision.missingCount, unknownCount: decision.unknownCount, quantityToCheck: decision.quantityToCheck,
    missingIngredients: [...decision.missingIngredients], unknownIngredients: [...decision.unknownIngredients], reasons: [...decision.reasons],
  };
}

async function storeResult(input: { userId: string; cacheKey: string; date: string; catalog: CatalogRow; response: TodayResponse; authorizedRecipeIds: string[] }) {
  const admin = createAdminSupabaseClient() as unknown as TodayAdminDb;
  const { data, error } = await admin.rpc("store_today_cache_v1", {
    p_user_id: input.userId, p_date: input.date, p_matcher_version: input.catalog.matcher_version,
    p_recommendation_version: TODAY_RECOMMENDATION_VERSION, p_cache_key: input.cacheKey,
    p_snapshot_key: input.response.snapshotKey,
    p_result: { response: input.response, authorizedRecipeIds: input.authorizedRecipeIds },
  });
  if (error || !data) throw new Error("TODAY_CACHE_WRITE_FAILED");
  const stored = data as { action?: string; result?: { response?: TodayResponse } };
  if (stored.action === "stale") return null;
  if (stored.action !== "stored" || !stored.result?.response) throw new Error("TODAY_CACHE_WRITE_FAILED");
  return stored.result.response;
}

async function calculateTodayAttempt(db: TodayDb, userId: string, date: string): Promise<TodayResponse | null> {
  const catalogResult = await db.from("catalog_versions").select("id,matcher_version").eq("active", true).limit(1);
  if (catalogResult.error) throw new Error("TODAY_READ_FAILED");
  const catalog = ((catalogResult.data ?? []) as CatalogRow[])[0];
  if (!catalog) throw new Error("CATALOG_NOT_READY");
  const keyResult = await db.rpc("read_today_cache_v1", { p_date: date, p_matcher_version: catalog.matcher_version, p_recommendation_version: TODAY_RECOMMENDATION_VERSION });
  if (keyResult.error || !keyResult.data) throw new Error("TODAY_READ_FAILED");
  const cache = keyResult.data as { action?: string; cacheKey?: string; result?: { response?: TodayResponse } };
  if (cache.action === "catalog_missing") throw new Error("CATALOG_NOT_READY");
  if (cache.action === "hit" && cache.result?.response) return cache.result.response;
  if (cache.action !== "miss" || !cache.cacheKey) throw new Error("TODAY_READ_FAILED");
  const cacheKey = cache.cacheKey;

  const pantryResult = await db.from("inventory_items").select("id,name,food_concept_id,commercial_product_id,deleted_at,normalization_status,stock_mode,stock_state,quantity_precision,quantity_exact,quantity_unit,freshness_precision,freshness_source,acquired_on,freshness_estimated_days,expiry_date_exact,knowledge_provenance").eq("user_id", userId).order("id");
  if (pantryResult.error) throw new Error("TODAY_READ_FAILED");
  const pantryRows = (pantryResult.data ?? []) as PantryRow[];
  const activeRows = pantryRows.filter(activePantry);
  const usableRows = activeRows.filter((row) => row.normalization_status === "confirmed" && row.food_concept_id
    && (row.stock_mode !== "presence" || row.stock_state === "present"));
  let state: TodayState = activeRows.length === 0 ? "empty_pantry" : usableRows.length === 0 ? "unresolved_pantry" : "ready";
  let main: TodayRecipe[] = [];
  let secondary: TodayRecipe[] = [];
  let authorizedRecipeIds: string[] = [];

  if (state === "ready") {
    const candidateResult = await db.rpc("find_today_recipe_candidates_v1", { p_limit: 250 });
    if (candidateResult.error) throw new Error("TODAY_READ_FAILED");
    const candidateIds = ((candidateResult.data ?? []) as Array<{ recipe_id: string }>).map((row) => row.recipe_id).slice(0, 250);
    if (candidateIds.length === 0) state = "no_candidates";
    else {
      const [recipesResult, conceptsResult, favoritesResult] = await Promise.all([
        db.from("recipes").select("id,name,recipe_ingredients(name,normalized_name,measure,food_concept_id,position)").in("id", candidateIds),
        db.from("food_concepts").select("id,display_name,food_concept_aliases(normalized_alias)").order("id"),
        db.from("favorite_recipes").select("recipe_id").eq("user_id", userId).is("deleted_at", null).in("recipe_id", candidateIds).order("recipe_id"),
      ]);
      if (recipesResult.error || conceptsResult.error || favoritesResult.error) throw new Error("TODAY_READ_FAILED");
      const concepts: FoodConceptInput[] = ((conceptsResult.data ?? []) as ConceptRow[]).map((row) => ({ id: row.id, displayName: row.display_name, aliases: row.food_concept_aliases.map((alias) => alias.normalized_alias) }));
      const favorites = new Set(((favoritesResult.data ?? []) as Array<{ recipe_id: string }>).map((row) => row.recipe_id));
      const pantry = pantryRows.map(pantryKnowledge);
      const recipes: TodayRecipeInput[] = ((recipesResult.data ?? []) as RecipeRow[]).map((row) => ({
        recipeId: row.id, name: row.name, favorite: favorites.has(row.id),
        ingredients: row.recipe_ingredients.sort((a, b) => a.position - b.position).map((item) => ({ name: item.name, normalizedName: normalizeTodayText(item.normalized_name ?? item.name), measure: item.measure, foodConceptId: item.food_concept_id })),
      }));
      const selected = selectTodayDecisions(recipes.map((recipe) => evaluateTodayRecipe({ recipe, pantry, concepts, today: date })));
      main = selected.main.map(publicRecipe); secondary = selected.secondary.map(publicRecipe);
      authorizedRecipeIds = [...main, ...secondary].filter((item) => item.missingCount > 0).map((item) => item.recipeId);
      if (main.length === 0) state = "no_candidates";
    }
  }
  const response: TodayResponse = {
    contract: TODAY_CONTRACT, date, generatedAt: new Date().toISOString(), state, main, secondary,
    snapshotKey: crypto.randomUUID(), catalogVersion: catalog.id, matcherVersion: catalog.matcher_version,
    recommendationVersion: TODAY_RECOMMENDATION_VERSION,
  };
  return storeResult({ userId, cacheKey, date, catalog, response, authorizedRecipeIds });
}

export async function calculateToday(db: TodayDb, userId: string, date: string): Promise<TodayResponse> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await calculateTodayAttempt(db, userId, date);
    if (result) return result;
  }
  throw new Error("TODAY_STATE_CHANGED");
}
