import functions from '@react-native-firebase/functions';
import { RecipeUi } from '../../database/models/RecipeCache';

/**
 * Firebase Cloud Functions Service
 * Calls existing Cloud Functions from whats-in-my-fridge-backend
 */

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
    const callable = functions().httpsCallable('getRecipeSuggestions');
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
    const callable = functions().httpsCallable('parseReceipt');
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
    const callable = functions().httpsCallable('uploadReceipt');
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
