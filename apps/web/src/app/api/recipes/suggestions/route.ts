import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recipeCacheKey, recipeInventoryHash } from "@/lib/recipes/hash";
import { recipeError, type RecipeSuggestionsResponse } from "@/lib/recipes/contracts";
import { suggestRecipes, type MatcherIngredient, type MatcherInventoryItem, type MatcherRecipe, type RecipeSuggestion, type VerifiedMapping } from "@/lib/recipes/matcher";

export const runtime = "nodejs";

type QueryResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Query = { select(columns?: string): Query; eq(column: string, value: unknown): Query; is(column: string, value: null): Query; order(column: string, options?: { ascending?: boolean }): Query; limit(value: number): QueryResult } & QueryResult;
type RecipeClient = { from(table: string): Query; rpc(name: string, args: Record<string, unknown>): QueryResult };
type CatalogRow = { id: string; matcher_version: string };
type RecipeRow = { id: string; external_id: string; name: string; instructions: string; recipe_ingredients: Array<{ name: string; normalized_name: string; measure: string | null; category: string | null; position: number }> };
type IngredientRow = { id: string; name: string; normalized_name: string | null; category: string | null; ingredient_aliases: Array<{ alias: string }> };

function validBody(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).every((key) => key === "forceRefresh") && (body.forceRefresh === undefined || body.forceRefresh === false);
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return recipeError("AUTH_REQUIRED", "Inicia sesión para obtener sugerencias");
  let body: unknown = null;
  try { body = request.headers.get("content-length") === "0" ? null : await request.json(); } catch { return recipeError("INVALID_REQUEST", "La solicitud no es válida"); }
  if (!validBody(body)) return recipeError("INVALID_REQUEST", "No se aceptan usuario, inventario, plan ni ownership enviados por el cliente");
  const db = supabase as unknown as RecipeClient;
  try {
    const catalogResult = await db.from("catalog_versions").select("id,matcher_version").eq("active", true).limit(1);
    const catalog = (catalogResult.data as CatalogRow[] | null)?.[0];
    if (catalogResult.error || !catalog) return recipeError("CATALOG_NOT_READY", "El catálogo todavía no está disponible", true);
    const inventoryResult = await db.from("inventory_items").select("id,name,category,quantity,unit").eq("user_id", user.id).is("deleted_at", null).order("id");
    if (inventoryResult.error) return recipeError("INVENTORY_INVALID", "No se pudo leer el inventario", true);
    const inventory = (inventoryResult.data ?? []) as MatcherInventoryItem[];
    const inventoryHash = recipeInventoryHash(inventory);
    const cacheKey = recipeCacheKey(inventoryHash, catalog.id, catalog.matcher_version);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    if (inventory.length === 0) return Response.json({ contract: "recipe-suggestions-v1", recipes: [], inventoryHash, catalogVersion: catalog.id, matcherVersion: catalog.matcher_version, inventoryEmpty: true, cache: { hit: false, expiresAt } } satisfies RecipeSuggestionsResponse);
    const claimResult = await db.rpc("begin_recipe_suggestion", { p_cache_key: cacheKey, p_inventory_hash: inventoryHash });
    if (claimResult.error) return recipeError("SUGGESTION_FAILED", "No se pudieron preparar las sugerencias", true);
    const claim = claimResult.data as { action: string; code?: string; result?: RecipeSuggestion[]; expiresAt?: string };
    if (claim.action === "reject") {
      if (claim.code === "SUGGESTION_QUOTA_EXHAUSTED") return recipeError("SUGGESTION_QUOTA_EXHAUSTED", "Has usado las 5 sugerencias nuevas de este mes");
      if (claim.code === "CATALOG_NOT_READY") return recipeError("CATALOG_NOT_READY", "El catálogo todavía no está disponible", true);
      return recipeError("SUGGESTION_FAILED", "No se pudieron preparar las sugerencias", true);
    }
    if (claim.action === "hit") return Response.json({ contract: "recipe-suggestions-v1", recipes: claim.result ?? [], inventoryHash, catalogVersion: catalog.id, matcherVersion: catalog.matcher_version, inventoryEmpty: false, cache: { hit: true, expiresAt: claim.expiresAt ?? expiresAt } } satisfies RecipeSuggestionsResponse);
    const [recipesResult, ingredientsResult, mappingsResult] = await Promise.all([
      db.from("recipes").select("id,external_id,name,instructions,recipe_ingredients(name,normalized_name,measure,category,position)").eq("catalog_version_id", catalog.id).order("external_id"),
      db.from("ingredients").select("id,name,normalized_name,category,ingredient_aliases(alias)").eq("catalog_version_id", catalog.id),
      db.from("ingredient_mappings").select("scanned_name,normalized_name,verified_by_user").eq("user_id", user.id).eq("verified_by_user", true).is("deleted_at", null),
    ]);
    if (recipesResult.error || ingredientsResult.error || mappingsResult.error) throw new Error("MATCHER_DATA_FAILED");
    const recipes: MatcherRecipe[] = ((recipesResult.data ?? []) as RecipeRow[]).map((recipe) => ({ id: recipe.id, externalId: recipe.external_id, name: recipe.name, instructions: recipe.instructions, ingredients: recipe.recipe_ingredients.sort((a, b) => a.position - b.position).map((ingredient) => ({ name: ingredient.name, normalizedName: ingredient.normalized_name, measure: ingredient.measure, category: ingredient.category })) }));
    const vocabulary: MatcherIngredient[] = ((ingredientsResult.data ?? []) as IngredientRow[]).map((ingredient) => ({ id: ingredient.id, name: ingredient.name, normalizedName: ingredient.normalized_name, category: ingredient.category, aliases: ingredient.ingredient_aliases.map((alias) => alias.alias) }));
    const mappings: VerifiedMapping[] = ((mappingsResult.data ?? []) as Array<{ scanned_name: string; normalized_name: string; verified_by_user: boolean }>).map((mapping) => ({ scannedName: mapping.scanned_name, normalizedName: mapping.normalized_name, verifiedByUser: mapping.verified_by_user }));
    const recipesOut = suggestRecipes({ inventory, recipes, vocabulary, mappings });
    const completion = await db.rpc("complete_recipe_suggestion", { p_cache_key: cacheKey, p_result: recipesOut });
    if (completion.error) throw new Error("CACHE_COMPLETE_FAILED");
    return Response.json({ contract: "recipe-suggestions-v1", recipes: recipesOut, inventoryHash, catalogVersion: catalog.id, matcherVersion: catalog.matcher_version, inventoryEmpty: false, cache: { hit: false, expiresAt: claim.expiresAt ?? expiresAt } } satisfies RecipeSuggestionsResponse);
  } catch {
    return recipeError("SUGGESTION_FAILED", "No se pudieron calcular las sugerencias", true);
  }
}
