import * as admin from "firebase-admin";

export interface VocabularyIngredient {
  normalized: string;
  synonyms?: string[];
  category: string;
  subcategory?: string;
  categorySpanish?: string;
  frequency: number;
}

export type VocabularyMap = Record<string, VocabularyIngredient>;

const CACHE_TTL_MS = 3600000; // 1 hora

let cache: VocabularyMap | null = null;
let cacheTime = 0;

/**
 * Carga el vocabulario normalizado desde Firebase Storage con caché de 1 hora.
 */
export async function loadVocabulary(): Promise<VocabularyMap> {
  const now = Date.now();

  if (cache && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }

  console.log("📥 Cargando vocabulario normalizado desde Storage...");

  const bucket = admin.storage().bucket();
  const [contents] = await bucket.file("normalized-ingredients.json").download();
  const data = JSON.parse(contents.toString());

  cache = (data.ingredients ?? {}) as VocabularyMap;
  cacheTime = now;

  console.log(`✅ Vocabulario cargado: ${Object.keys(cache!).length} ingredientes`);

  return cache!;
}
