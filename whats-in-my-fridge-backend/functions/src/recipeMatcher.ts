import * as fs from "fs";
import * as path from "path";
import { Recipe, RecipeMatch } from "./types";

let cachedRecipes: Recipe[] | null = null;

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
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
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
  inventoryItems: string[],
  threshold: number = 0.65
): string | null {
  const normalizedIngredient = normalizeString(ingredient);
  const ingredientWords = normalizedIngredient.split(" ");

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const item of inventoryItems) {
    const normalizedItem = normalizeString(item);
    const itemWords = normalizedItem.split(" ");

    // Estrategia 1: Exact match
    if (normalizedIngredient === normalizedItem) {
      return item;
    }

    // Estrategia 2: Substring match
    // Si el item del inventario está contenido en el ingrediente de la receta
    // Ejemplo: "rice" está en "raw white rice"
    if (normalizedIngredient.includes(normalizedItem) && normalizedItem.length >= 3) {
      const score = 0.95; // Alta prioridad para substring match
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    // Si el ingrediente de la receta está contenido en el item del inventario
    // Ejemplo: "tomato" está en "cherry tomatoes"
    if (normalizedItem.includes(normalizedIngredient) && normalizedIngredient.length >= 3) {
      const score = 0.9;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
    }

    // Estrategia 3: Keyword match
    // Verifica si las palabras principales coinciden
    // Filtra palabras comunes (artículos, preposiciones)
    const commonWords = new Set(["the", "a", "an", "of", "with", "in", "on", "raw", "fresh", "dried"]);
    const importantIngredientWords = ingredientWords.filter((w) => w.length > 2 && !commonWords.has(w));
    const importantItemWords = itemWords.filter((w) => w.length > 2 && !commonWords.has(w));

    if (importantIngredientWords.length > 0 && importantItemWords.length > 0) {
      const matchingWords = importantIngredientWords.filter((w) =>
        importantItemWords.some((iw) => iw.includes(w) || w.includes(iw))
      );
      const keywordScore = matchingWords.length / Math.max(importantIngredientWords.length, importantItemWords.length);

      if (keywordScore >= 0.5 && keywordScore > bestScore * 0.85) {
        bestScore = keywordScore * 0.85;
        bestMatch = item;
      }
    }

    // Estrategia 4: Fuzzy matching (fallback)
    const similarity = calculateSimilarity(ingredient, item);
    if (similarity >= threshold && similarity > bestScore) {
      bestScore = similarity;
      bestMatch = item;
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

  for (const recipe of recipes) {
    const matchedIngredients: string[] = [];

    // Usar ingredientsNormalized para hacer el matching (si existe)
    // pero SIEMPRE calcular el porcentaje basado en la lista original de ingredients
    const ingredientsForMatching = recipe.ingredientsNormalized || recipe.ingredients;
    const totalIngredientsCount = recipe.ingredients.length; // Siempre usar la lista original para el conteo

    // Verificar cada ingrediente de la receta
    for (const ingredient of ingredientsForMatching) {
      const match = matchIngredient(ingredient, inventoryItems);
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
import * as admin from "firebase-admin";

// Cache del vocabulario normalizado
let vocabularyCache: any = null;
let vocabularyCacheTime: number = 0;
const CACHE_TTL_MS = 3600000; // 1 hora

/**
 * Carga el vocabulario normalizado desde Firebase Storage
 */
async function loadVocabulary(): Promise<any> {
  const now = Date.now();

  // Usar caché si está disponible y no ha expirado
  if (vocabularyCache && now - vocabularyCacheTime < CACHE_TTL_MS) {
    return vocabularyCache;
  }

  console.log("📥 Cargando vocabulario normalizado desde Storage...");

  const bucket = admin.storage().bucket();
  const file = bucket.file("normalized-ingredients.json");

  const [contents] = await file.download();
  const data = JSON.parse(contents.toString());

  vocabularyCache = data.ingredients;
  vocabularyCacheTime = now;

  console.log(`✅ Vocabulario cargado: ${Object.keys(vocabularyCache!).length} ingredientes`);

  return vocabularyCache!;
}

/**
 * Obtiene la categoría de un ingrediente desde el vocabulario
 */
function getIngredientCategory(ingredientName: string, vocabulary: any): string | null {
  const normalized = normalizeString(ingredientName);

  // Buscar coincidencia exacta
  if (vocabulary[normalized]) {
    return vocabulary[normalized].categorySpanish || vocabulary[normalized].category;
  }

  // Buscar en sinónimos
  for (const [, data] of Object.entries<any>(vocabulary)) {
    if (data.synonyms && data.synonyms.some((syn: string) => normalizeString(syn) === normalized)) {
      return data.categorySpanish || data.category;
    }
  }

  return null;
}

/**
 * Encuentra recetas basadas en categorías del inventario y ordena por match real
 */
function findMatchingRecipesByCategory(
  inventoryItems: string[],
  inventoryCategories: Set<string>,
  vocabulary: any,
  minMatchPercentage: number = 0.3
): RecipeMatch[] {
  const matches: RecipeMatch[] = [];
  const recipes = getRecipes();

  for (const recipe of recipes) {
    const matchedIngredients: string[] = [];
    let hasIngredientFromInventoryCategory = false;

    const ingredientsForMatching = recipe.ingredientsNormalized || recipe.ingredients;
    const totalIngredientsCount = recipe.ingredients.length;

    // Verificar cada ingrediente de la receta
    for (const ingredient of ingredientsForMatching) {
      // Intentar match exacto primero
      const match = matchIngredient(ingredient, inventoryItems);
      if (match) {
        matchedIngredients.push(match);
      }

      // Verificar si el ingrediente pertenece a una categoría del inventario
      const ingredientCategory = getIngredientCategory(ingredient, vocabulary);
      if (ingredientCategory && inventoryCategories.has(ingredientCategory)) {
        hasIngredientFromInventoryCategory = true;
      }
    }

    // Calcular porcentaje de match basado en ingredientes reales
    const matchPercentage = matchedIngredients.length / totalIngredientsCount;
    const missingCount = totalIngredientsCount - matchedIngredients.length;

    // Solo incluir recetas que:
    // 1. Tengan al menos un ingrediente de una categoría del inventario
    // 2. Cumplan el porcentaje mínimo de match de ingredientes reales
    // 3. Cumplan los requisitos mínimos de la receta
    if (
      hasIngredientFromInventoryCategory &&
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

    try {
      // Cargar vocabulario para obtener categorías
      const vocabulary = await loadVocabulary();

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
      console.log(`🍳 Found ${matches.length} matching recipes`);

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
          instructions: match.recipe.instructions,
        })),
      };
    } catch (error) {
      console.error("Error obteniendo sugerencias:", error);
      throw new functions.https.HttpsError("internal", "Error obteniendo sugerencias de recetas");
    }
  });
