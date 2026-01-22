import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import { ensureFirebaseApp } from './app';
import { RecipeUi } from '../../database/models/RecipeCache';

/**
 * Firebase Cloud Functions Service
 * Calls existing Cloud Functions from whats-in-my-fridge-backend
 */
ensureFirebaseApp();

const getProjectId = () => {
  return functions().app?.options?.projectId || 'what-s-in-my-fridge-a2a07';
};

const getCallableUrl = (region: string, name: string) => {
  const projectId = getProjectId();
  return `https://${region}-${projectId}.cloudfunctions.net/${name}`;
};

const getAuthToken = async () => {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión');
  }

  return user.getIdToken(true);
};

const callCallableUrl = async <T>(
  region: string,
  name: string,
  data: Record<string, unknown>
): Promise<T> => {
  const token = await getAuthToken();
  const url = getCallableUrl(region, name);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });

  const rawText = await response.text();
  let payload: any = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch (parseError) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${rawText.slice(0, 200)}`
    );
  }

  if (!response.ok || payload?.error) {
    const message =
      payload?.error?.message ||
      payload?.error?.status ||
      `Error llamando a ${name}`;
    throw new Error(message);
  }

  return (payload?.data ?? payload?.result) as T;
};

/**
 * Parameters for getRecipeSuggestions Cloud Function
 */
export interface GetRecipeSuggestionsParams {
  ingredients: string[];
  cookingTime: number;
  availableUtensils: string[];
}

/**
 * Get recipe suggestions from Cloud Function
 * Equivalent to calling Firebase Functions from Android app
 */
export const getRecipeSuggestions = async (
  params: GetRecipeSuggestionsParams
): Promise<RecipeUi[]> => {
  try {
    const callable = functions().httpsCallableFromUrl(
      getCallableUrl('europe-west1', 'getRecipeSuggestions')
    );
    const result = await callable(params);

    if (!result.data || !result.data.recipes) {
      throw new Error('Invalid response from Cloud Function');
    }

    return result.data.recipes;
  } catch (error: any) {
    console.error('Error calling getRecipeSuggestions:', error);

    if (error.code === 'functions/unauthenticated') {
      throw new Error('Debes iniciar sesión para obtener recetas');
    } else if (error.code === 'functions/permission-denied') {
      throw new Error('No tienes permiso para acceder a esta función');
    } else if (error.code === 'functions/resource-exhausted') {
      throw new Error('Has alcanzado el límite de llamadas mensuales');
    }

    throw new Error('Error al obtener sugerencias de recetas');
  }
};

/**
 * Parse receipt using Cloud Vision API via Cloud Function
 */
export const parseReceipt = async (imageUri: string): Promise<string> => {
  try {
    const callable = functions().httpsCallableFromUrl(
      getCallableUrl('us-central1', 'parseReceipt')
    );
    const result = await callable({ imageUri });

    if (!result.data || !result.data.text) {
      throw new Error('Invalid response from Cloud Function');
    }

    return result.data.text;
  } catch (error: any) {
    console.error('Error calling parseReceipt:', error);

    if (error.code === 'functions/unauthenticated') {
      throw new Error('Debes iniciar sesión para escanear recibos');
    } else if (error.code === 'functions/invalid-argument') {
      throw new Error('Imagen inválida');
    }

    throw new Error('Error al procesar el recibo');
  }
};

/**
 * Upload receipt image to Firebase Storage and trigger parsing
 */
export const uploadReceipt = async (imageUri: string): Promise<{ uploadUrl: string }> => {
  try {
    const callable = functions().httpsCallableFromUrl(
      getCallableUrl('us-central1', 'uploadReceipt')
    );
    const result = await callable({ imageUri });

    if (!result.data || !result.data.uploadUrl) {
      throw new Error('Invalid response from Cloud Function');
    }

    return result.data;
  } catch (error: any) {
    console.error('Error calling uploadReceipt:', error);
    throw new Error('Error al subir el recibo');
  }
};

/**
 * Response from normalizeScannedIngredient Cloud Function
 */
export interface NormalizationResult {
  scannedName: string;
  normalizedName: string | null;
  confidence: number;
  method: 'exact' | 'synonym' | 'partial' | 'fuzzy' | 'llm' | 'none';
}

/**
 * Normalize a scanned ingredient name to its generic form
 * Uses hybrid strategy: exact → synonym → partial → fuzzy → LLM
 *
 * @param ingredientName - The scanned ingredient name (e.g., "Bio EHL Champignon")
 * @param useLlmFallback - Whether to use LLM fallback for low-confidence matches (default: false)
 * @returns Normalized ingredient name and confidence score
 *
 * @example
 * const result = await normalizeScannedIngredient("Bio EHL Champignon");
 * // { scannedName: "Bio EHL Champignon", normalizedName: "mushroom", confidence: 0.8, method: "partial" }
 */
export const normalizeScannedIngredient = async (
  ingredientName: string,
  useLlmFallback: boolean = false
): Promise<NormalizationResult> => {
  try {
    const result = await callCallableUrl<{ result: NormalizationResult }>(
      'europe-west1',
      'normalizeScannedIngredient',
      { ingredientName, useLlmFallback }
    );

    if (!result || !result.result) {
      throw new Error('Invalid response from Cloud Function');
    }

    return result.result;
  } catch (error: any) {
    console.error('Error calling normalizeScannedIngredient:', error);

    if (error.code === 'functions/invalid-argument') {
      throw new Error('Nombre de ingrediente inválido');
    }

    throw new Error('Error al normalizar ingrediente');
  }
};

/**
 * Normalize multiple scanned ingredients in batch
 *
 * @param ingredients - Array of scanned ingredient names
 * @param useLlmFallback - Whether to use LLM fallback for low-confidence matches (default: false)
 * @returns Array of normalization results
 */
export const normalizeScannedIngredientsBatch = async (
  ingredients: string[],
  useLlmFallback: boolean = false
): Promise<NormalizationResult[]> => {
  try {
    const result = await callCallableUrl<{ results: NormalizationResult[] }>(
      'europe-west1',
      'normalizeScannedIngredientsBatch',
      { ingredients, useLlmFallback }
    );

    if (!result || !result.results) {
      throw new Error('Invalid response from Cloud Function');
    }

    return result.results;
  } catch (error: any) {
    console.error('Error calling normalizeScannedIngredientsBatch:', error);

    if (error.code === 'functions/invalid-argument') {
      throw new Error('Lista de ingredientes inválida');
    }

    throw new Error('Error al normalizar ingredientes');
  }
};
