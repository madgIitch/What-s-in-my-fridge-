#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const MATCHER_VERSION = "matcher-v1";

export function normalize(value) {
  return value.toLocaleLowerCase("en-US").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function slug(value) { return normalize(value).replace(/ /g, "-") || "ingredient"; }
function requiredString(value, label) { if (typeof value !== "string" || !value.trim()) throw new Error(`CATALOG_INVALID: ${label}`); return value.trim(); }

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function prepareCatalog(progress, vocabularySource) {
  if (!progress || !Array.isArray(progress.normalizedRecipes)) throw new Error("CATALOG_INVALID: normalizedRecipes");
  if (!vocabularySource || typeof vocabularySource.ingredients !== "object" || Array.isArray(vocabularySource.ingredients)) throw new Error("CATALOG_INVALID: ingredients");
  const usedSlugs = new Map();
  const vocabulary = Object.entries(vocabularySource.ingredients).sort(([a],[b]) => a.localeCompare(b)).map(([key, entry], index) => {
    if (!entry || typeof entry !== "object") throw new Error(`CATALOG_INVALID: ingredients[${index}]`);
    const name = requiredString(entry.normalized ?? key, `ingredients[${index}].normalized`);
    const aliases = entry.synonyms ?? [];
    if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== "string" || !alias.trim())) throw new Error(`CATALOG_INVALID: ingredients[${index}].synonyms`);
    const baseSlug = slug(name); const occurrence = (usedSlugs.get(baseSlug) ?? 0) + 1; usedSlugs.set(baseSlug, occurrence);
    return { slug: occurrence === 1 ? baseSlug : `${baseSlug}-${occurrence}`, name, normalizedName: normalize(name), aliases: [...new Set(aliases.map((alias) => alias.trim()))].sort(), category: typeof entry.category === "string" && entry.category ? entry.category : "other", subcategory: typeof entry.subcategory === "string" ? entry.subcategory : "", categorySpanish: typeof entry.categorySpanish === "string" ? entry.categorySpanish : "" };
  }).sort((a, b) => a.slug.localeCompare(b.slug));
  const aliasToVocabulary = new Map();
  for (const ingredient of vocabulary) for (const alias of [ingredient.name, ...ingredient.aliases]) aliasToVocabulary.set(normalize(alias), ingredient);
  const recipes = progress.normalizedRecipes.map((recipe, recipeIndex) => {
    if (!recipe || typeof recipe !== "object") throw new Error(`CATALOG_INVALID: normalizedRecipes[${recipeIndex}]`);
    const externalId = requiredString(recipe.id, `normalizedRecipes[${recipeIndex}].id`);
    const name = requiredString(recipe.name, `normalizedRecipes[${recipeIndex}].name`);
    if (!Array.isArray(recipe.ingredients)) throw new Error(`CATALOG_INVALID: normalizedRecipes[${recipeIndex}].ingredients`);
    const ingredients = recipe.ingredients.map((raw, ingredientIndex) => {
      const value = typeof raw === "string" ? { name: raw } : raw;
      if (!value || typeof value !== "object") throw new Error(`CATALOG_INVALID: normalizedRecipes[${recipeIndex}].ingredients[${ingredientIndex}]`);
      const ingredientName = requiredString(value.name ?? value.ingredient, `normalizedRecipes[${recipeIndex}].ingredients[${ingredientIndex}].name`);
      const normalizedName = normalize(value.normalizedName ?? ingredientName);
      const known = aliasToVocabulary.get(normalizedName);
      return { name: ingredientName, normalizedName: known?.normalizedName ?? normalizedName, measure: typeof value.measure === "string" ? value.measure : null, category: typeof value.category === "string" ? value.category : known?.category ?? null };
    });
    return { externalId, name, instructions: typeof recipe.instructions === "string" ? recipe.instructions : "", ingredients, metadata: { originalIngredientsCount: Number.isInteger(recipe.originalIngredientsCount) ? recipe.originalIngredientsCount : null } };
  }).sort((a, b) => a.externalId.localeCompare(b.externalId));
  const payload = { sourceVersion: requiredString(vocabularySource.version ?? "unknown", "version"), matcherVersion: MATCHER_VERSION, vocabulary, recipes };
  const checksum = createHash("sha256").update(canonicalJson(payload)).digest("hex");
  return { ...payload, checksum };
}

export async function importCatalog({ progressPath, vocabularyPath, dryRun = false, fetchImpl = fetch, env = process.env }) {
  const [progress, vocabulary] = await Promise.all([readFile(progressPath, "utf8").then(JSON.parse), readFile(vocabularyPath, "utf8").then(JSON.parse)]);
  const prepared = prepareCatalog(progress, vocabulary);
  if (dryRun) return { status: "dry_run", checksum: prepared.checksum, recipes: prepared.recipes.length, ingredients: prepared.vocabulary.length };
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  const response = await fetchImpl(`${url}/rest/v1/rpc/activate_recipe_catalog`, { method: "POST", headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ p_checksum: prepared.checksum, p_source_version: prepared.sourceVersion, p_matcher_version: prepared.matcherVersion, p_vocabulary: prepared.vocabulary, p_recipes: prepared.recipes }) });
  if (!response.ok) throw new Error(`CATALOG_IMPORT_FAILED: ${response.status} ${await response.text()}`);
  return { ...(await response.json()), checksum: prepared.checksum, recipes: prepared.recipes.length, ingredients: prepared.vocabulary.length };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const args = new Set(process.argv.slice(2));
  const result = await importCatalog({ progressPath: path.join(root, "whats-in-my-fridge-backend/data/progress.json"), vocabularyPath: path.join(root, "whats-in-my-fridge-backend/data/normalized-ingredients.json"), dryRun: args.has("--dry-run") });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
