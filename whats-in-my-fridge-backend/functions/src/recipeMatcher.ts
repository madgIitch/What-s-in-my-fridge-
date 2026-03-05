import * as fs from "fs";
import * as path from "path";
import { Recipe, RecipeMatch } from "./types";
import { levenshteinSimilarity } from "./utils/levenshtein";
import { loadVocabulary, VocabularyMap } from "./utils/vocabulary";

let cachedRecipes: Recipe[] | null = null;
let recipeCategoryIndex: Map<string, Recipe[]> | null = null;
let synonymCategoryIndex: Map<string, string> | null = null;
let lastVocabulary: VocabularyMap | null = null;

type NormalizedInventoryItem = {
  original: string;
  normalized: string;
  words: string[];
};

const COMMON_WORDS = new Set(["the", "a", "an", "of", "with", "in", "on", "raw", "fresh", "dried"]);
const EARLY_EXIT_SCORE = 0.95;

function getRecipes(): Recipe[] {
  if (cachedRecipes) {
    return cachedRecipes;
  }

  const recipesPath = path.join(__dirname, "../data/recipes.json");
  if (!fs.existsSync(recipesPath)) {
    console.warn(`recipes.json not found at ${recipesPath}.`);
    cachedRecipes = [];
    return cachedRecipes;
  }

  try {
    const recipesData = JSON.parse(fs.readFileSync(recipesPath, "utf-8"));
    cachedRecipes = Array.isArray(recipesData?.recipes) ? recipesData.recipes : [];
  } catch (error) {
    console.error("Failed to load recipes.json:", error);
    cachedRecipes = [];
  }

  return cachedRecipes ?? [];
}

/**
 * Normaliza un string para comparación (lowercase, sin acentos, sin espacios extra)
 */
function normalizeString(str: string): string {
  const singularizeToken = (token: string): string => {
    if (token.length <= 3) return token;
    if (token.endsWith("ies")) {
      return `${token.slice(0, -3)}y`;
    }
    if (token.endsWith("sses") || token.endsWith("ss")) {
      return token;
    }
    if (token.endsWith("es")) {
      return token.slice(0, -2);
    }
    if (token.endsWith("s")) {
      return token.slice(0, -1);
    }
    return token;
  };

  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((token) => singularizeToken(token))
    .join(" ");
}

/**
 * Calcula similitud entre dos strings usando Levenshtein distance
 * Retorna valor entre 0 (totalmente diferente) y 1 (idéntico)
 */
function normalizeInventoryItems(inventoryItems: string[]): NormalizedInventoryItem[] {
  return inventoryItems.map((item) => {
    const normalized = normalizeString(item);
    return {
      original: item,
      normalized,
      words: normalized.split(" "),
    };
  });
}


/**
 * Verifica si un ingrediente de receta coincide con algún item del inventario
 * Usa matching inteligente con múltiples estrategias:
 * 1. Exact match (normalizado)
 * 2. Substring match (inventario contiene ingrediente o viceversa)
 * 3. Keyword match (palabras clave importantes)
 * 4. Fuzzy matching como fallback
 */
function matchIngredient(
  ingredient: string,
  inventoryItems: NormalizedInventoryItem[],
  threshold: number = 0.65
): string | null {
  const normalizedIngredient = normalizeString(ingredient);
  const ingredientWords = normalizedIngredient.split(" ");
  const importantIngredientWords = ingredientWords.filter((w) => w.length > 2 && !COMMON_WORDS.has(w));

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const item of inventoryItems) {
    const normalizedItem = item.normalized;
    const itemWords = item.words;
    const importantItemWords = itemWords.filter((w) => w.length > 2 && !COMMON_WORDS.has(w));

    // Estrategia 1: Exact match
    if (normalizedIngredient === normalizedItem) {
      return item.original;
    }

    // Estrategia 2: Substring match
    // Si el item del inventario está contenido en el ingrediente de la receta
    // Ejemplo: "rice" está en "raw white rice"
    if (normalizedIngredient.includes(normalizedItem) && normalizedItem.length >= 3) {
      const score = 0.95; // Alta prioridad para substring match
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item.original;
      }
    }

    // Si el ingrediente de la receta está contenido en el item del inventario
    // Ejemplo: "tomato" está en "cherry tomatoes"
    if (normalizedItem.includes(normalizedIngredient) && normalizedIngredient.length >= 3) {
      const score = 0.9;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item.original;
      }
    }

    // Estrategia 3: Keyword match
    // Verifica si las palabras principales coinciden
    // Filtra palabras comunes (artículos, preposiciones)

    if (importantIngredientWords.length > 0 && importantItemWords.length > 0) {
      const matchingWords = importantIngredientWords.filter((w) =>
        importantItemWords.some((iw) => iw.includes(w) || w.includes(iw))
      );
      const keywordScore = matchingWords.length / Math.max(importantIngredientWords.length, importantItemWords.length);

      if (keywordScore >= 0.5 && keywordScore > bestScore * 0.85) {
        bestScore = keywordScore * 0.85;
        bestMatch = item.original;
      }
    }

    // Estrategia 4: Fuzzy matching (fallback)
    const similarity = levenshteinSimilarity(normalizedIngredient, normalizedItem);
    if (similarity >= threshold && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = item.original;
    }

    if (bestScore >= EARLY_EXIT_SCORE && bestMatch) {
      return bestMatch;
    }
  }

  return bestMatch;
}

/**
 * Encuentra recetas que se pueden hacer con los items del inventario
 * @param inventoryItems Lista de nombres de items disponibles
 * @param minMatchPercentage Porcentaje mínimo de ingredientes necesarios (default: 0.75)
 * @returns Lista de recetas ordenadas por % de match descendente
 */
export function findMatchingRecipes(
  inventoryItems: string[],
  minMatchPercentage: number = 0.75
): RecipeMatch[] {
  const matches: RecipeMatch[] = [];
  const recipes = getRecipes();
  const normalizedInventoryItems = normalizeInventoryItems(inventoryItems);

  for (const recipe of recipes) {
    const matchedIngredients: string[] = [];

    // Usar ingredientsNormalized para hacer el matching (si existe)
    // pero SIEMPRE calcular el porcentaje basado en la lista original de ingredients
    const ingredientsForMatching = recipe.ingredientsNormalized || recipe.ingredients;
    const totalIngredientsCount = recipe.ingredients.length; // Siempre usar la lista original para el conteo

    // Verificar cada ingrediente de la receta
    for (const ingredient of ingredientsForMatching) {
      const match = matchIngredient(ingredient, normalizedInventoryItems);
      if (match) {
        matchedIngredients.push(match);
      }
    }

    // Calcular porcentaje de match basado en la cantidad REAL de ingredientes de la receta
    const matchPercentage = matchedIngredients.length / totalIngredientsCount;
    const missingCount = totalIngredientsCount - matchedIngredients.length;

    // Verificar si cumple requisitos mínimos
    if (
      matchedIngredients.length >= recipe.minIngredients &&
      matchPercentage >= minMatchPercentage
    ) {
      matches.push({
        recipe,
        matchedIngredients,
        matchPercentage,
        missingCount,
      });
    }
  }

  // Ordenar por porcentaje de match descendente
  matches.sort((a, b) => {
    if (a.missingCount !== b.missingCount) {
      return a.missingCount - b.missingCount;
    }
    return b.matchPercentage - a.matchPercentage;
  });

  return matches;
}

/**
 * Cloud Function para obtener sugerencias de recetas
 */
import * as functions from "firebase-functions";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { checkAndIncrementUsage, FREE_RECIPE_LIMIT } from "./usageLimits";

function buildSynonymCategoryIndex(vocabulary: VocabularyMap): Map<string, string> {
  const index = new Map<string, string>();

  for (const [normalizedName, data] of Object.entries(vocabulary)) {
    const category = data.categorySpanish || data.category;
    if (!category) {
      continue;
    }

    index.set(normalizedName, category);

    if (data.synonyms) {
      for (const synonym of data.synonyms) {
        index.set(normalizeString(synonym), category);
      }
    }
  }

  return index;
}

async function loadVocabularyWithIndexes(): Promise<VocabularyMap> {
  const vocabulary = await loadVocabulary();

  if (vocabulary !== lastVocabulary) {
    lastVocabulary = vocabulary;
    synonymCategoryIndex = buildSynonymCategoryIndex(vocabulary);
    recipeCategoryIndex = null;
  }

  return vocabulary;
}

/**
 * Obtiene la categoría de un ingrediente desde el vocabulario
 */
function getIngredientCategory(ingredientName: string, vocabulary: VocabularyMap): string | null {
  const normalized = normalizeString(ingredientName);

  // Buscar coincidencia exacta
  const directMatch = vocabulary[normalized];
  if (directMatch) {
    return directMatch.categorySpanish || directMatch.category || null;
  }

  // Buscar en sinónimos
  if (!synonymCategoryIndex) {
    synonymCategoryIndex = buildSynonymCategoryIndex(vocabulary);
  }

  return synonymCategoryIndex.get(normalized) ?? null;
}

function buildRecipeIndexByCategory(
  recipes: Recipe[],
  vocabulary: VocabularyMap
): Map<string, Recipe[]> {
  const index = new Map<string, Recipe[]>();

  for (const recipe of recipes) {
    const ingredientsForMatching = recipe.ingredientsNormalized || recipe.ingredients;
    const categories = new Set<string>();

    for (const ingredient of ingredientsForMatching) {
      const category = getIngredientCategory(ingredient, vocabulary);
      if (category) {
        categories.add(category);
      }
    }

    for (const category of categories) {
      const recipesForCategory = index.get(category);
      if (recipesForCategory) {
        recipesForCategory.push(recipe);
      } else {
        index.set(category, [recipe]);
      }
    }
  }

  return index;
}

function getRecipesForCategories(
  inventoryCategories: Set<string>,
  vocabulary: VocabularyMap
): Recipe[] {
  if (!recipeCategoryIndex) {
    const recipes = getRecipes();
    recipeCategoryIndex = buildRecipeIndexByCategory(recipes, vocabulary);
    console.log(`Recipe category index built (${recipeCategoryIndex.size} categories)`);
  }
  const index = recipeCategoryIndex;
  if (!index) {
    return [];
  }

  const candidateRecipes = new Map<string, Recipe>();

  for (const category of inventoryCategories) {
    const recipesByCategory = index.get(category);
    if (!recipesByCategory) {
      continue;
    }

    for (const recipe of recipesByCategory) {
      candidateRecipes.set(recipe.id, recipe);
    }
  }

  return Array.from(candidateRecipes.values());
}

/**
 * Encuentra recetas basadas en categorías del inventario y ordena por match real
 */
function findMatchingRecipesByCategory(
  inventoryItems: string[],
  inventoryCategories: Set<string>,
  vocabulary: VocabularyMap,
  minMatchPercentage: number = 0.3
): RecipeMatch[] {
  const matches: RecipeMatch[] = [];
  if (inventoryCategories.size === 0) {
    return matches;
  }

  const recipes = getRecipesForCategories(inventoryCategories, vocabulary);
  const normalizedInventoryItems = normalizeInventoryItems(inventoryItems);

  for (const recipe of recipes) {
    const matchedIngredients: string[] = [];

    const ingredientsForMatching = recipe.ingredientsNormalized || recipe.ingredients;
    const totalIngredientsCount = recipe.ingredients.length;

    // Verificar cada ingrediente de la receta
    for (const ingredient of ingredientsForMatching) {
      // Intentar match exacto primero
      const match = matchIngredient(ingredient, normalizedInventoryItems);
      if (match) {
        matchedIngredients.push(match);
      }

      // Verificar si el ingrediente pertenece a una categoría del inventario
    }

    // Calcular porcentaje de match basado en ingredientes reales
    const matchPercentage = matchedIngredients.length / totalIngredientsCount;
    const missingCount = totalIngredientsCount - matchedIngredients.length;

    // Solo incluir recetas que:
    // 1. Tengan al menos un ingrediente de una categoría del inventario
    // 2. Cumplan el porcentaje mínimo de match de ingredientes reales
    // 3. Cumplan los requisitos mínimos de la receta
    if (
      matchedIngredients.length >= recipe.minIngredients &&
      matchPercentage >= minMatchPercentage
    ) {
      matches.push({
        recipe,
        matchedIngredients,
        matchPercentage,
        missingCount,
      });
    }
  }

  // Ordenar por porcentaje de match descendente (ingredientes reales)
  matches.sort((a, b) => {
    if (a.missingCount !== b.missingCount) {
      return a.missingCount - b.missingCount;
    }
    return b.matchPercentage - a.matchPercentage;
  });

  return matches;
}

export const getRecipeSuggestions = functions
  .region("europe-west1")
  .runWith({ memory: "2GB", timeoutSeconds: 300 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Usuario debe estar autenticado");
    }

    const userId = context.auth.uid;
    const start = Date.now();

    try {
      // Enforce server-side monthly usage limit before doing any work
      await checkAndIncrementUsage(userId, "recipeCallsUsed", FREE_RECIPE_LIMIT);

      // Cargar vocabulario para obtener categorías
      const vocabulary = await loadVocabularyWithIndexes();

      // Obtener items del inventario del usuario desde Firestore
      const inventorySnapshot = await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .collection("inventory")
        .get();

      // Extraer nombres normalizados Y categorías del inventario
      const inventoryItems = inventorySnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return (data.normalizedName || data.name) as string;
        })
        .filter((name) => name && name.trim().length > 0);

      // Extraer categorías únicas del inventario
      const inventoryCategories = new Set<string>();
      inventorySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const category = data.category;
        if (category && category.trim().length > 0) {
          inventoryCategories.add(category);
        }
      });

      console.log(`📦 Inventory items (normalized): ${inventoryItems.join(", ")}`);
      console.log(`🏷️ Inventory categories: ${Array.from(inventoryCategories).join(", ")}`);

      // Encontrar recetas que coincidan
      const matches = findMatchingRecipesByCategory(
        inventoryItems,
        inventoryCategories,
        vocabulary,
        0.3 // 30% mínimo para considerar recetas con ingredientes de categorías similares
      );
      logger.info("feature_usage", {
        feature: "recipe_suggestions",
        userId,
        durationMs: Date.now() - start,
        success: true,
        inventoryItemCount: inventoryItems.length,
        categoryCount: inventoryCategories.size,
        matchesFound: matches.length,
      });

      return {
        success: true,
        recipes: matches.map((match) => ({
          id: match.recipe.id,
          name: match.recipe.name,
          matchPercentage: Math.round(match.matchPercentage * 100),
          matchedIngredients: match.matchedIngredients,
          missingIngredients: (() => {
            const normalizedMatches = new Set(
              match.matchedIngredients.map((item) => normalizeString(item))
            );
            const recipeIngredients = match.recipe.ingredients;
            const normalizedRecipeIngredients =
              match.recipe.ingredientsNormalized || match.recipe.ingredients;

            return recipeIngredients.filter((ingredient, index) => {
              const normalized =
                normalizedRecipeIngredients[index] || ingredient;
              return !normalizedMatches.has(normalizeString(normalized));
            });
          })(),
          ingredientsWithMeasures: match.recipe.ingredientsWithMeasures ?? [],
          instructions: match.recipe.instructions,
        })),
      };
    } catch (error: any) {
      logger.error("feature_usage", {
        feature: "recipe_suggestions",
        userId,
        durationMs: Date.now() - start,
        success: false,
        error: error.message,
      });
      throw new functions.https.HttpsError("internal", "Error obteniendo sugerencias de recetas");
    }
  });
