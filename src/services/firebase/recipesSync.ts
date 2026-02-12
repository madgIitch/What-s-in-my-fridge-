import firestore from '@react-native-firebase/firestore';
import { ensureFirebaseApp } from './app';
import { RecipeUi } from '../../database/models/RecipeCache';

ensureFirebaseApp();

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

/**
 * Save a favorite recipe to Firestore
 */
export const saveRecipeToFirestore = async (
  userId: string,
  recipe: RecipeUi
): Promise<void> => {
  await firestore()
    .collection('users')
    .doc(userId)
    .collection('savedRecipes')
    .doc(recipe.id)
    .set({
      name: recipe.name,
      matchPercentage: recipe.matchPercentage,
      matchedIngredients: recipe.matchedIngredients || [],
      missingIngredients: recipe.missingIngredients || [],
      ingredientsWithMeasures: recipe.ingredientsWithMeasures || [],
      instructions: recipe.instructions || '',
      savedAt: Date.now(),
    });
};

/**
 * Delete a favorite recipe from Firestore
 */
export const deleteRecipeFromFirestore = async (
  userId: string,
  recipeId: string
): Promise<void> => {
  await firestore()
    .collection('users')
    .doc(userId)
    .collection('savedRecipes')
    .doc(recipeId)
    .delete();
};

/**
 * Load favorite recipes from Firestore (initial sync)
 */
export const loadRecipesFromFirestore = async (
  userId: string
): Promise<RecipeUi[]> => {
  const snapshot = await firestore()
    .collection('users')
    .doc(userId)
    .collection('savedRecipes')
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: typeof data.name === 'string' ? data.name : 'Receta',
      matchPercentage:
        typeof data.matchPercentage === 'number' ? data.matchPercentage : 0,
      matchedIngredients: toStringArray(data.matchedIngredients),
      missingIngredients: toStringArray(data.missingIngredients),
      ingredientsWithMeasures: toStringArray(data.ingredientsWithMeasures),
      instructions:
        typeof data.instructions === 'string' ? data.instructions : '',
    };
  });
};
