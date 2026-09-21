export const MATCHER_VERSION = "matcher-v1" as const;
export const FUZZY_THRESHOLD = 0.65;
export type { ImportedRecipe, ImportedRecipeIngredient } from "./imported";
export { importedRecipeJsonSchema, validateImportedRecipe } from "./imported";

export type MatchStrategy = "verified" | "exact" | "alias" | "substring" | "keyword" | "fuzzy";

export interface MatcherIngredient {
  id: string;
  name: string;
  normalizedName?: string | null;
  category?: string | null;
  aliases?: string[];
}

export interface MatcherInventoryItem {
  id: string;
  name: string;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
}

export interface MatcherRecipeIngredient {
  name: string;
  normalizedName?: string | null;
  measure?: string | null;
  category?: string | null;
}

export interface MatcherRecipe {
  id: string;
  externalId: string;
  name: string;
  ingredients: MatcherRecipeIngredient[];
  instructions?: string | null;
}

export interface VerifiedMapping {
  scannedName: string;
  normalizedName: string;
  verifiedByUser: boolean;
}

export interface RecipeSuggestion {
  id: string;
  name: string;
  matchPercentage: number;
  matchedIngredients: string[];
  missingIngredients: string[];
  ingredientsWithMeasures: string[];
  instructions: string;
}

export function normalizeIngredient(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(singularize)
    .join(" ");
}

export function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses") || word.endsWith("ss")) return word;
  if (word.endsWith("es")) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous.splice(0, previous.length, ...current);
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function keywords(value: string): string[] {
  return normalizeIngredient(value).split(" ").filter((token) => token.length >= 3);
}

export function matchIngredient(
  requested: string,
  inventory: MatcherInventoryItem[],
  vocabulary: MatcherIngredient[],
  mappings: VerifiedMapping[] = [],
): { item: MatcherInventoryItem; strategy: MatchStrategy } | null {
  const target = normalizeIngredient(requested);
  const candidates = inventory.map((item) => ({ item, normalized: normalizeIngredient(item.name) }));
  const verified = candidates.find((candidate) => mappings.some((mapping) => mapping.verifiedByUser && normalizeIngredient(mapping.scannedName) === candidate.normalized && normalizeIngredient(mapping.normalizedName) === target));
  if (verified) return { item: verified.item, strategy: "verified" };
  const exact = candidates.find((candidate) => candidate.normalized === target);
  if (exact) return { item: exact.item, strategy: "exact" };
  const vocabularyEntry = vocabulary.find((entry) => normalizeIngredient(entry.normalizedName ?? entry.name) === target || entry.aliases?.some((alias) => normalizeIngredient(alias) === target));
  if (vocabularyEntry) {
    const canonical = normalizeIngredient(vocabularyEntry.normalizedName ?? vocabularyEntry.name);
    const alias = candidates.find((candidate) => candidate.normalized === canonical || vocabularyEntry.aliases?.some((value) => normalizeIngredient(value) === candidate.normalized));
    if (alias) return { item: alias.item, strategy: "alias" };
  }
  const substring = candidates.find((candidate) => candidate.normalized.includes(target) || target.includes(candidate.normalized));
  if (substring) return { item: substring.item, strategy: "substring" };
  const targetKeywords = keywords(target);
  const keyword = candidates.find((candidate) => targetKeywords.some((token) => keywords(candidate.normalized).includes(token)));
  if (keyword) return { item: keyword.item, strategy: "keyword" };
  const fuzzy = candidates
    .map((candidate) => ({ ...candidate, score: levenshteinSimilarity(target, candidate.normalized) }))
    .filter((candidate) => candidate.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))[0];
  return fuzzy ? { item: fuzzy.item, strategy: "fuzzy" } : null;
}

export function suggestRecipes(input: {
  inventory: MatcherInventoryItem[];
  recipes: MatcherRecipe[];
  vocabulary?: MatcherIngredient[];
  mappings?: VerifiedMapping[];
}): RecipeSuggestion[] {
  if (input.inventory.length === 0) return [];
  const vocabulary = input.vocabulary ?? [];
  return input.recipes.map((recipe) => {
    const matched: string[] = [];
    const missing: string[] = [];
    for (const ingredient of recipe.ingredients) {
      const match = matchIngredient(ingredient.normalizedName ?? ingredient.name, input.inventory, vocabulary, input.mappings);
      (match ? matched : missing).push(ingredient.name);
    }
    return {
      recipe,
      suggestion: {
        id: recipe.id,
        name: recipe.name,
        matchPercentage: recipe.ingredients.length ? Math.round((matched.length / recipe.ingredients.length) * 100) : 0,
        matchedIngredients: matched,
        missingIngredients: missing,
        ingredientsWithMeasures: recipe.ingredients.map((ingredient) => ingredient.measure ? `${ingredient.measure} ${ingredient.name}` : ingredient.name),
        instructions: recipe.instructions ?? "",
      },
    };
  }).filter(({ suggestion }) => suggestion.matchedIngredients.length > 0)
    .sort((a, b) => a.suggestion.missingIngredients.length - b.suggestion.missingIngredients.length
    || b.suggestion.matchPercentage - a.suggestion.matchPercentage
    || a.recipe.externalId.localeCompare(b.recipe.externalId))
    .map(({ suggestion }) => suggestion);
}
