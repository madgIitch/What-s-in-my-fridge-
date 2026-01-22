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
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/\s+/g, " ")
    .trim();
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
 * Usa fuzzy matching con umbral de 0.7
 */
function matchIngredient(
  ingredient: string,
  inventoryItems: string[],
  threshold: number = 0.7
): string | null {
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const item of inventoryItems) {
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

    // Verificar cada ingrediente de la receta
    for (const ingredient of recipe.ingredients) {
      const match = matchIngredient(ingredient, inventoryItems);
      if (match) {
        matchedIngredients.push(match);
      }
    }

    // Calcular porcentaje de match
    const matchPercentage = matchedIngredients.length / recipe.ingredients.length;

    // Verificar si cumple requisitos mínimos
    if (
      matchedIngredients.length >= recipe.minIngredients &&
      matchPercentage >= minMatchPercentage
    ) {
      matches.push({
        recipe,
        matchedIngredients,
        matchPercentage,
      });
    }
  }

  // Ordenar por porcentaje de match descendente
  matches.sort((a, b) => b.matchPercentage - a.matchPercentage);

  return matches;
}

/**
 * Cloud Function para obtener sugerencias de recetas
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export const getRecipeSuggestions = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Usuario debe estar autenticado");
  }

  const userId = context.auth.uid;

  try {
    // Obtener items del inventario del usuario desde Firestore
    const inventorySnapshot = await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .collection("inventory")
      .get();

    const inventoryItems = inventorySnapshot.docs.map((doc) => doc.data().name as string);

    // Encontrar recetas que coincidan
    const matches = findMatchingRecipes(inventoryItems, 0.6); // 60% mínimo

    return {
      success: true,
      recipes: matches.map((match) => ({
        id: match.recipe.id,
        name: match.recipe.name,
        matchPercentage: Math.round(match.matchPercentage * 100),
        matchedIngredients: match.matchedIngredients,
        missingIngredients: match.recipe.ingredients.filter(
          (ing) => !match.matchedIngredients.includes(ing)
        ),
        instructions: match.recipe.instructions,
      })),
    };
  } catch (error) {
    console.error("Error obteniendo sugerencias:", error);
    throw new functions.https.HttpsError("internal", "Error obteniendo sugerencias de recetas");
  }
});
