#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prepareCatalog } from "./import-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export async function importCatalogStaged({ progressPath, vocabularyPath, env = process.env, fetchImpl = fetch, log = () => {} }) {
  const [progress, vocabulary] = await Promise.all([readFile(progressPath, "utf8").then(JSON.parse), readFile(vocabularyPath, "utf8").then(JSON.parse)]);
  const catalog = prepareCatalog(progress, vocabulary);
  const base = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
  async function request(table, { method = "GET", query = "", body, prefer } = {}) {
    const response = await fetchImpl(`${base}/rest/v1/${table}${query}`, { method, headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Error(`CATALOG_IMPORT_FAILED ${table} ${response.status}: ${(await response.text()).slice(0, 400)}`);
    if (method === "HEAD") return Number(response.headers.get("content-range")?.split("/")[1]);
    const content = await response.text();
    return content ? JSON.parse(content) : null;
  }
  const versionRows = await request("catalog_versions", { query: `?checksum=eq.${catalog.checksum}&select=id,active` });
  if (versionRows[0]?.active) return { status: "already_imported", catalogVersion: versionRows[0].id, checksum: catalog.checksum };
  const versionId = versionRows[0]?.id ?? (await request("catalog_versions", { method: "POST", body: [{ checksum: catalog.checksum, source_version: catalog.sourceVersion, matcher_version: catalog.matcherVersion, recipe_count: catalog.recipes.length, ingredient_count: catalog.vocabulary.length }], prefer: "return=representation" }))[0].id;
  const ingredientRows = catalog.vocabulary.map((item) => ({ catalog_version_id: versionId, slug: item.slug, name: item.name, normalized_name: item.normalizedName, category: item.category, synonyms: item.aliases, subcategory: item.subcategory, category_spanish: item.categorySpanish, seed_version: catalog.sourceVersion }));
  const existingIngredients = await request("ingredients", { query: `?catalog_version_id=eq.${versionId}&select=id,slug&limit=1000` });
  const existingSlugs = new Set(existingIngredients.map(({ slug }) => slug));
  for (const batch of chunk(ingredientRows.filter(({ slug }) => !existingSlugs.has(slug)), 200)) await request("ingredients", { method: "POST", body: batch, prefer: "return=minimal" });
  const ingredients = await request("ingredients", { query: `?catalog_version_id=eq.${versionId}&select=id,slug&limit=1000` });
  const ingredientIds = new Map(ingredients.map(({ id, slug }) => [slug, id]));
  const aliases = catalog.vocabulary.flatMap((item) => [...new Set(item.aliases.map((alias) => alias.toLowerCase()))].map((alias) => ({ ingredient_id: ingredientIds.get(item.slug), alias, normalized_alias: alias, catalog_version_id: versionId })));
  for (const batch of chunk(aliases, 500)) await request("ingredient_aliases", { method: "POST", query: "?on_conflict=catalog_version_id,normalized_alias,ingredient_id", body: batch, prefer: "resolution=merge-duplicates,return=minimal" });
  let completed = 0;
  for (const recipes of chunk(catalog.recipes, 200)) {
    const rows = recipes.map((recipe) => ({ catalog_version_id: versionId, external_id: recipe.externalId, name: recipe.name, instructions: recipe.instructions, metadata: recipe.metadata }));
    const inserted = await request("recipes", { method: "POST", query: "?on_conflict=catalog_version_id,external_id&select=id,external_id", body: rows, prefer: "resolution=merge-duplicates,return=representation" });
    const ids = new Map(inserted.map(({ id, external_id }) => [external_id, id]));
    const recipeIngredients = recipes.flatMap((recipe) => recipe.ingredients.map((item, position) => ({ recipe_id: ids.get(recipe.externalId), position, name: item.name, normalized_name: item.normalizedName, measure: item.measure, category: item.category })));
    for (const batch of chunk(recipeIngredients, 500)) await request("recipe_ingredients", { method: "POST", query: "?on_conflict=recipe_id,position", body: batch, prefer: "resolution=merge-duplicates,return=minimal" });
    completed += recipes.length;
    if (completed % 2000 === 0 || completed === catalog.recipes.length) log({ completed, total: catalog.recipes.length });
  }
  const expectedRecipeIngredients = catalog.recipes.reduce((count, recipe) => count + recipe.ingredients.length, 0);
  const counts = await Promise.all([
    request("recipes", { method: "HEAD", query: `?catalog_version_id=eq.${versionId}&select=id`, prefer: "count=exact" }),
    request("recipe_ingredients", { method: "HEAD", query: `?select=id,recipes!inner(catalog_version_id)&recipes.catalog_version_id=eq.${versionId}`, prefer: "count=exact" }),
  ]);
  if (counts[0] !== catalog.recipes.length || counts[1] !== expectedRecipeIngredients) throw new Error(`CATALOG_COUNT_MISMATCH ${counts[0]}/${catalog.recipes.length} recipes, ${counts[1]}/${expectedRecipeIngredients} ingredients`);
  const active = await request("catalog_versions", { query: "?active=eq.true&select=id&limit=1" });
  if (active.length) throw new Error("CATALOG_ACTIVE_VERSION_EXISTS: atomic replacement requires a database migration");
  await request("catalog_versions", { method: "PATCH", query: `?id=eq.${versionId}`, body: { active: true }, prefer: "return=minimal" });
  return { status: "imported", catalogVersion: versionId, checksum: catalog.checksum, recipes: counts[0], recipeIngredients: counts[1] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importCatalogStaged({ progressPath: path.join(root, "whats-in-my-fridge-backend/data/progress.json"), vocabularyPath: path.join(root, "whats-in-my-fridge-backend/data/normalized-ingredients.json"), log: (value) => process.stdout.write(`${JSON.stringify(value)}\n`) })
    .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
