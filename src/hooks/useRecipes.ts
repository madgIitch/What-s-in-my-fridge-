import { useCallback } from 'react';
import { database } from '../database';
import RecipeCache, { RecipeUi } from '../database/models/RecipeCache';
import { Q } from '@nozbe/watermelondb';
import functions from '@react-native-firebase/functions';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { useRecipeStore } from '../stores/useRecipeStore';

/**
 * Generate cache key from sorted ingredients list
 */
export function generateInventoryHash(ingredients: string[]): string {
  return [...ingredients].sort().join(',');
}

/**
 * Hook to manage recipe suggestions with caching
 */
export function useRecipes() {
  const { recipes, loading, error, setRecipes, setLoading, setError } = useRecipeStore();

  const {
    isPro,
    monthlyRecipeCallsUsed,
    incrementRecipeCalls
  } = usePreferencesStore();

  /**
   * Get cached recipes for given ingredients
   */
  const getCachedRecipes = useCallback(async (ingredientsList: string[]): Promise<RecipeUi[] | null> => {
    try {
      const hash = generateInventoryHash(ingredientsList);
      const recipeCacheCollection = database.get<RecipeCache>('recipe_cache');

      const cached = await recipeCacheCollection
        .query(Q.where('ingredients_hash', hash))
        .fetch();

      if (cached.length > 0) {
        const cache = cached[0];

        // Check if expired
        if (cache.isExpired) {
          // Delete expired cache
          await database.write(async () => {
            await cache.destroyPermanently();
          });
          return null;
        }

        console.log(`Using cached recipes (${cache.minutesUntilExpiry} min left)`);
        return cache.recipes;
      }

      return null;
    } catch (err) {
      console.error('Error getting cached recipes:', err);
      return null;
    }
  }, []);

  /**
   * Cache recipes for given ingredients
   */
  const cacheRecipes = useCallback(async (
    ingredientsList: string[],
    recipesToCache: RecipeUi[]
  ): Promise<void> => {
    try {
      const hash = generateInventoryHash(ingredientsList);
      const recipeCacheCollection = database.get<RecipeCache>('recipe_cache');

      await database.write(async () => {
        // Delete existing cache for this hash
        const existing = await recipeCacheCollection
          .query(Q.where('ingredients_hash', hash))
          .fetch();

        for (const cache of existing) {
          await cache.destroyPermanently();
        }

        // Create new cache entry
        await recipeCacheCollection.create((cache) => {
          cache.ingredientsHash = hash;
          cache.recipesJson = JSON.stringify(recipesToCache);
          cache.timestamp = Date.now();
          cache.ttlMinutes = 60; // 60 minutes TTL
        });
      });

      console.log('Recipes cached successfully');
    } catch (err) {
      console.error('Error caching recipes:', err);
    }
  }, []);

  /**
   * Delete all expired caches
   */
  const deleteExpiredCaches = useCallback(async (): Promise<void> => {
    try {
      const recipeCacheCollection = database.get<RecipeCache>('recipe_cache');
      const allCaches = await recipeCacheCollection.query().fetch();

      const now = Date.now();
      const expiredCaches = allCaches.filter((cache) => {
        const expiryTime = cache.timestamp + cache.ttlMinutes * 60 * 1000;
        return now > expiryTime;
      });

      if (expiredCaches.length > 0) {
        await database.write(async () => {
          for (const cache of expiredCaches) {
            await cache.destroyPermanently();
          }
        });
        console.log(`Deleted ${expiredCaches.length} expired caches`);
      }
    } catch (err) {
      console.error('Error deleting expired caches:', err);
    }
  }, []);

  /**
   * Get recipe suggestions from Cloud Function
   */
  const getRecipeSuggestions = useCallback(async (
    ingredientsList: string[],
    cookingTime: number,
    utensils: string[]
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Check monthly limit
      const maxCalls = isPro ? 100 : 10;
      if (monthlyRecipeCallsUsed >= maxCalls) {
        const errorMsg = `Límite mensual alcanzado (${maxCalls} llamadas). ${
          !isPro ? 'Actualiza a Pro para más llamadas.' : ''
        }`;
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Check cache first
      const cachedRecipes = await getCachedRecipes(ingredientsList);
      if (cachedRecipes) {
        console.log('Setting recipes from cache:', cachedRecipes.length, 'recipes');
        setRecipes(cachedRecipes);
        setLoading(false);
        return;
      }

      // Call Cloud Function with normalized ingredients
      // Use httpsCallableFromUrl for europe-west1 region
      const projectId = 'what-s-in-my-fridge-a2a07';
      const functionUrl = `https://europe-west1-${projectId}.cloudfunctions.net/getRecipeSuggestions`;
      const getRecipeSuggestionsCallable = functions().httpsCallableFromUrl(functionUrl);

      const result = await getRecipeSuggestionsCallable({
        ingredients: ingredientsList,
        cookingTime,
        utensils,
      });

      if (result.data.success && result.data.recipes) {
        const newRecipes = result.data.recipes;
        setRecipes(newRecipes);

        // Cache the results
        await cacheRecipes(ingredientsList, newRecipes);

        // Increment call counter
        incrementRecipeCalls();

        // Clean up expired caches
        await deleteExpiredCaches();
      } else {
        setError('No se pudieron obtener recetas');
      }
    } catch (err: any) {
      console.error('Error getting recipe suggestions:', err);
      setError(err.message || 'Error al obtener recetas');
    } finally {
      setLoading(false);
    }
  }, [
    isPro,
    monthlyRecipeCallsUsed,
    getCachedRecipes,
    cacheRecipes,
    incrementRecipeCalls,
    deleteExpiredCaches,
  ]);

  /**
   * Clear all recipe caches
   */
  const clearAllCaches = useCallback(async (): Promise<void> => {
    try {
      const recipeCacheCollection = database.get<RecipeCache>('recipe_cache');
      const allCaches = await recipeCacheCollection.query().fetch();

      await database.write(async () => {
        for (const cache of allCaches) {
          await cache.destroyPermanently();
        }
      });

      // Limpiar también el estado de las recetas en la UI
      setRecipes([]);

      console.log('All recipe caches cleared');
    } catch (err) {
      console.error('Error clearing caches:', err);
    }
  }, [setRecipes]);

  return {
    recipes,
    loading,
    error,
    getRecipeSuggestions,
    getCachedRecipes,
    clearAllCaches,
  };
}
