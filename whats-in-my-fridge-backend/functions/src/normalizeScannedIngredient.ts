// Cloud Function para normalizar ingredientes escaneados
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

// ========== INTERFACES ==========

interface NormalizedIngredient {
  normalized: string;
  synonyms: string[];
  category: string;
  subcategory?: string;
  categorySpanish?: string; // Categoría en español para la app
  frequency: number;
}

interface NormalizedVocabulary {
  [key: string]: NormalizedIngredient;
}

interface NormalizationResult {
  scannedName: string;
  normalizedName: string | null;
  categorySpanish?: string; // Categoría en español auto-asignada
  confidence: number;
  method: "exact" | "synonym" | "partial" | "fuzzy" | "llm" | "none";
}

// ========== CACHÉ DEL VOCABULARIO ==========

let vocabularyCache: NormalizedVocabulary | null = null;
let vocabularyCacheTime: number = 0;
const CACHE_TTL_MS = 3600000; // 1 hora

/**
 * Carga el vocabulario normalizado desde Firebase Storage
 */
async function loadVocabulary(): Promise<NormalizedVocabulary> {
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

// ========== ALGORITMOS DE MATCHING ==========

/**
 * Calcula similitud de Levenshtein (normalizada 0-1)
 */
function levenshteinSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Limpia términos de marketing/etiquetas ecológicas del nombre del ingrediente
 * Ejemplos:
 * - "BIO-GURKEN GO BIO" → "GURKEN"
 * - "GO BIO TOMATEN" → "TOMATEN"
 * - "BIO CLEMENTINEN" → "CLEMENTINEN"
 */
function cleanMarketingTerms(scannedName: string): string {
  let cleaned = scannedName.trim();

  // Términos de marketing a eliminar (case-insensitive)
  const marketingTerms = [
    // Prefijos comunes
    /^bio[-\s]*/i,           // "BIO-", "BIO "
    /^go\s+bio\s*/i,         // "GO BIO "
    /^organic\s*/i,          // "ORGANIC "
    /^eco\s*/i,              // "ECO "
    /^fair\s+trade\s*/i,     // "FAIR TRADE "

    // Sufijos comunes
    /\s+go\s+bio$/i,         // " GO BIO"
    /\s+bio$/i,              // " BIO"
    /\s+organic$/i,          // " ORGANIC"
    /\s+eco$/i,              // " ECO"

    // Términos en medio (entre espacios)
    /\s+bio\s+/i,            // " BIO "
    /\s+go\s+/i,             // " GO "
    /\s+organic\s+/i,        // " ORGANIC "
  ];

  // Aplicar cada patrón de limpieza
  for (const pattern of marketingTerms) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  // Limpiar espacios múltiples y trimear
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  console.log(`🧹 Cleaning: "${scannedName}" → "${cleaned}"`);

  return cleaned;
}

/**
 * Normaliza un ingrediente usando estrategia híbrida en cascada
 */
async function normalizeIngredient(
  scannedName: string,
  vocabulary: NormalizedVocabulary,
  useLlmFallback: boolean = true
): Promise<NormalizationResult> {
  // Limpiar términos de marketing ANTES de hacer matching
  const cleanedName = cleanMarketingTerms(scannedName);
  const scannedLower = cleanedName.toLowerCase().trim();

  // 1. Búsqueda exacta
  if (vocabulary[scannedLower]) {
    const ingredientData = vocabulary[scannedLower];
    return {
      scannedName,
      normalizedName: ingredientData.normalized,
      categorySpanish: ingredientData.categorySpanish,
      confidence: 1.0,
      method: "exact",
    };
  }

  // 2. Búsqueda en sinónimos
  for (const [, data] of Object.entries(vocabulary)) {
    if (data.synonyms.some((syn) => syn.toLowerCase() === scannedLower)) {
      return {
        scannedName,
        normalizedName: data.normalized,
        categorySpanish: data.categorySpanish,
        confidence: 0.95,
        method: "synonym",
      };
    }
  }

  // 3. Búsqueda parcial (contiene)
  for (const [normalized, data] of Object.entries(vocabulary)) {
    if (scannedLower.includes(normalized.toLowerCase())) {
      return {
        scannedName,
        normalizedName: normalized,
        categorySpanish: data.categorySpanish,
        confidence: 0.8,
        method: "partial",
      };
    }
  }

  // 4. Fuzzy matching con Levenshtein
  let bestMatch: { normalized: string; categorySpanish?: string; score: number } | null = null;

  for (const [normalized, data] of Object.entries(vocabulary)) {
    // Comparar con nombre normalizado
    const scoreNormalized = levenshteinSimilarity(scannedLower, normalized.toLowerCase());

    // Comparar con sinónimos
    const scoreSynonyms = Math.max(
      ...data.synonyms.map((syn) => levenshteinSimilarity(scannedLower, syn.toLowerCase()))
    );

    const score = Math.max(scoreNormalized, scoreSynonyms);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        normalized: data.normalized,
        categorySpanish: data.categorySpanish,
        score
      };
    }
  }

  // Si fuzzy matching tiene alta confianza (> 0.75), usarlo
  if (bestMatch && bestMatch.score > 0.75) {
    return {
      scannedName,
      normalizedName: bestMatch.normalized,
      categorySpanish: bestMatch.categorySpanish,
      confidence: bestMatch.score,
      method: "fuzzy",
    };
  }

  // 5. LLM Fallback (Ollama local o API)
  if (useLlmFallback && bestMatch && bestMatch.score > 0.5) {
    try {
      const llmResult = await normalizWithLLM(scannedName, vocabulary);
      if (llmResult) {
        // Buscar la categoría del resultado del LLM
        const llmIngredientData = vocabulary[llmResult.toLowerCase()];
        return {
          scannedName,
          normalizedName: llmResult,
          categorySpanish: llmIngredientData?.categorySpanish,
          confidence: 0.85,
          method: "llm",
        };
      }
    } catch (error) {
      console.error("❌ Error con LLM fallback:", error);
      // Continuar con el mejor match de fuzzy
    }
  }

  // 6. Si fuzzy match es decente (> 0.5), usarlo con baja confianza
  if (bestMatch && bestMatch.score > 0.5) {
    return {
      scannedName,
      normalizedName: bestMatch.normalized,
      categorySpanish: bestMatch.categorySpanish,
      confidence: bestMatch.score,
      method: "fuzzy",
    };
  }

  // 7. No se encontró normalización
  return {
    scannedName,
    normalizedName: null,
    categorySpanish: undefined,
    confidence: 0,
    method: "none",
  };
}

/**
 * Normaliza usando LLM (Ollama local o Claude API)
 */
async function normalizWithLLM(
  scannedName: string,
  vocabulary: NormalizedVocabulary
): Promise<string | null> {
  const vocabularyList = Object.keys(vocabulary).slice(0, 100); // Top 100 para contexto

  const prompt = `You are a food ingredient normalizer. Given a scanned ingredient name from a supermarket receipt, normalize it to its generic form.

Scanned ingredient: "${scannedName}"

Common normalized ingredients: ${vocabularyList.join(", ")}

Return ONLY the normalized ingredient name (one or two words maximum). If you cannot normalize it, return "unknown".

Examples:
- "Bio EHL Champignon" → "mushroom"
- "Salchichas Oscar Mayer" → "sausage"
- "Tomate Cherry 500g" → "tomato"

Normalized ingredient:`;

  try {
    // Intentar con Ollama local primero
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";

    const response = await axios.post(
      ollamaUrl,
      {
        model: "llama3.1:8b",
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
        },
      },
      {
        timeout: 30000,
      }
    );

    const result = response.data.response.trim().toLowerCase();

    // Validar que el resultado existe en el vocabulario
    if (vocabulary[result]) {
      return vocabulary[result].normalized;
    }

    // Buscar en sinónimos
    for (const [, data] of Object.entries(vocabulary)) {
      if (data.synonyms.some((syn) => syn.toLowerCase() === result)) {
        return data.normalized;
      }
    }

    return null;
  } catch (error) {
    console.error("❌ Error con Ollama:", error);
    return null;
  }
}

// ========== CLOUD FUNCTION ==========

export const normalizeScannedIngredient = functions
  .region("europe-west1")
  .https.onCall(async (data) => {
    try {
      const { ingredientName, useLlmFallback = true } = data;

      if (!ingredientName || typeof ingredientName !== "string") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "ingredientName es requerido y debe ser un string"
        );
      }

      // Cargar vocabulario
      const vocabulary = await loadVocabulary();

      // Normalizar ingrediente
      const result = await normalizeIngredient(ingredientName, vocabulary, useLlmFallback);

      console.log(
        `✅ Normalizado: "${ingredientName}" → "${result.normalizedName}" (${result.method}, confidence: ${result.confidence})`
      );

      return {
        success: true,
        result,
      };
    } catch (error: any) {
      console.error("❌ Error en normalizeScannedIngredient:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

// ========== BATCH NORMALIZATION ==========

export const normalizeScannedIngredientsBatch = functions
  .region("europe-west1")
  .https.onCall(async (data) => {
    try {
      const { ingredients, useLlmFallback = true } = data;

      if (!Array.isArray(ingredients)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "ingredients debe ser un array de strings"
        );
      }

      // Cargar vocabulario
      const vocabulary = await loadVocabulary();

      // Normalizar todos los ingredientes
      const results = await Promise.all(
        ingredients.map((ingredient) =>
          normalizeIngredient(ingredient, vocabulary, useLlmFallback)
        )
      );

      return {
        success: true,
        results,
      };
    } catch (error: any) {
      console.error("❌ Error en normalizeScannedIngredientsBatch:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });
