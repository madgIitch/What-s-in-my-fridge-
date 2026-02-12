import { useCallback, useEffect, useRef } from 'react';
import { database } from '../database';
import FavoriteRecipe from '../database/models/FavoriteRecipe';
import { RecipeUi } from '../database/models/RecipeCache';
import { Q } from '@nozbe/watermelondb';
import { useFavoritesStore } from '../stores/useFavoritesStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useInventoryStore } from '../stores/useInventoryStore';
import {
  deleteRecipeFromFirestore,
  loadRecipesFromFirestore,
  saveRecipeToFirestore,
} from '../services/firebase/recipesSync';
import { calculateRecipeMatch } from '../utils/recipeMatchCalculator';

/**
 * Hook to manage favorite recipes with WatermelonDB
 */
export function useFavorites() {
  const { favorites, setFavorites, addFavorite: addToStore, removeFavorite: removeFromStore, isFavorite, loading, error, setLoading, setError } = useFavoritesStore();
  const { user } = useAuthStore();
  const { items: inventoryItems } = useInventoryStore();
  const hasSyncedRef = useRef<string | null>(null);

  /**
   * Load all favorite recipes from DB
   */
  const loadFavorites = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      setFavorites([]);
      return;
    }

    try {
      setLoading(true);
      const favoriteRecipesCollection = database.get<FavoriteRecipe>('favorite_recipes');

      const allFavorites = await favoriteRecipesCollection
        .query(Q.where('user_id', user.uid))
        .fetch();

      const recipesUi: RecipeUi[] = allFavorites.map((fav) => fav.toRecipeUi());

      setFavorites(recipesUi);
    } catch (err: any) {
      console.error('Error loading favorites:', err);
      setError(err.message || 'Error al cargar favoritos');
    } finally {
      setLoading(false);
    }
  }, [setFavorites, setLoading, setError, user?.uid]);

  /**
   * Add a recipe to favorites
   */
  const addFavorite = useCallback(async (recipe: RecipeUi) => {
    try {
      if (!user) {
        setError('Debes iniciar sesión para guardar favoritos');
        return;
      }

      const favoriteRecipesCollection = database.get<FavoriteRecipe>('favorite_recipes');

      // Check if already exists
      const existing = await favoriteRecipesCollection
        .query(Q.and(Q.where('recipe_id', recipe.id), Q.where('user_id', user.uid)))
        .fetch();

      if (existing.length > 0) {
        console.log('Recipe already in favorites');
        return;
      }

      // Add to database
      await database.write(async () => {
        await favoriteRecipesCollection.create((fav) => {
          fav.recipeId = recipe.id;
          fav.name = recipe.name;
          fav.matchPercentage = recipe.matchPercentage;
          fav.matchedIngredients = JSON.stringify(recipe.matchedIngredients || []);
          fav.missingIngredients = JSON.stringify(recipe.missingIngredients || []);
          fav.ingredientsWithMeasures = JSON.stringify(recipe.ingredientsWithMeasures || []);
          fav.instructions = recipe.instructions || '';
          fav.userId = user.uid;
          fav.savedAt = Date.now();
        });
      });

      await saveRecipeToFirestore(user.uid, recipe);

      // Add to store
      addToStore(recipe);

      console.log('Recipe added to favorites:', recipe.name);
    } catch (err: any) {
      console.error('Error adding favorite:', err);
      setError(err.message || 'Error al agregar favorito');
    }
  }, [user, addToStore, setError]);

  /**
   * Remove a recipe from favorites
   */
  const removeFavorite = useCallback(async (recipeId: string) => {
    try {
      if (!user) {
        setError('Debes iniciar sesiÃ³n para gestionar favoritos');
        return;
      }

      const favoriteRecipesCollection = database.get<FavoriteRecipe>('favorite_recipes');
      const existing = await favoriteRecipesCollection
        .query(Q.and(Q.where('recipe_id', recipeId), Q.where('user_id', user.uid)))
        .fetch();

      if (existing.length === 0) {
        console.log('Recipe not in favorites');
        return;
      }

      // Remove from database
      await database.write(async () => {
        for (const fav of existing) {
          await fav.destroyPermanently();
        }
      });

      await deleteRecipeFromFirestore(user.uid, recipeId);

      // Remove from store
      removeFromStore(recipeId);

      console.log('Recipe removed from favorites');
    } catch (err: any) {
      console.error('Error removing favorite:', err);
      setError(err.message || 'Error al eliminar favorito');
    }
  }, [removeFromStore, setError, user]);

  /**
   * Bidirectional sync between local favorites and Firestore favorites
   */
  const syncFavorites = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const favoriteRecipesCollection = database.get<FavoriteRecipe>('favorite_recipes');
      const remoteRecipes = await loadRecipesFromFirestore(user.uid);
      const localFavorites = await favoriteRecipesCollection
        .query(Q.where('user_id', user.uid))
        .fetch();

      const localById = new Map(localFavorites.map((fav) => [fav.recipeId, fav]));
      const remoteById = new Map(remoteRecipes.map((recipe) => [recipe.id, recipe]));

      const remoteOnly = remoteRecipes.filter((recipe) => !localById.has(recipe.id));
      const localOnly = localFavorites.filter((fav) => !remoteById.has(fav.recipeId));

      if (remoteOnly.length > 0) {
        await database.write(async () => {
          for (const recipe of remoteOnly) {
            await favoriteRecipesCollection.create((fav) => {
              fav.recipeId = recipe.id;
              fav.name = recipe.name;
              fav.matchPercentage = recipe.matchPercentage;
              fav.matchedIngredients = JSON.stringify(recipe.matchedIngredients || []);
              fav.missingIngredients = JSON.stringify(recipe.missingIngredients || []);
              fav.ingredientsWithMeasures = JSON.stringify(recipe.ingredientsWithMeasures || []);
              fav.instructions = recipe.instructions || '';
              fav.userId = user.uid;
              fav.savedAt = Date.now();
            });
          }
        });
      }

      for (const localRecipe of localOnly) {
        await saveRecipeToFirestore(user.uid, localRecipe.toRecipeUi());
      }

      await loadFavorites();
    } catch (err: any) {
      console.error('Error syncing favorites:', err);
      setError(err.message || 'Error al sincronizar favoritos');
    }
  }, [loadFavorites, setError, user?.uid]);

  /**
   * Persist dynamic match values to local DB.
   * Firestore sync is only sent for significant changes (>10 points).
   */
  const persistUpdatedMatches = useCallback(async (updatedRecipes?: RecipeUi[]) => {
    if (!user?.uid) return;

    const recipesToPersist = updatedRecipes || favorites;
    if (recipesToPersist.length === 0) return;

    try {
      const favoriteRecipesCollection = database.get<FavoriteRecipe>('favorite_recipes');
      const significantChanges: RecipeUi[] = [];

      await database.write(async () => {
        for (const recipe of recipesToPersist) {
          const records = await favoriteRecipesCollection
            .query(Q.and(Q.where('recipe_id', recipe.id), Q.where('user_id', user.uid)))
            .fetch();

          if (records.length === 0) continue;

          const record = records[0];
          const previousMatch = record.matchPercentage;

          const matchedJson = JSON.stringify(recipe.matchedIngredients || []);
          const missingJson = JSON.stringify(recipe.missingIngredients || []);

          const hasLocalDiff =
            record.matchPercentage !== recipe.matchPercentage ||
            record.matchedIngredients !== matchedJson ||
            record.missingIngredients !== missingJson;

          if (!hasLocalDiff) continue;

          await record.update((fav) => {
            fav.matchPercentage = recipe.matchPercentage;
            fav.matchedIngredients = matchedJson;
            fav.missingIngredients = missingJson;
          });

          if (Math.abs(previousMatch - recipe.matchPercentage) > 10) {
            significantChanges.push(recipe);
          }
        }
      });

      for (const recipe of significantChanges) {
        await saveRecipeToFirestore(user.uid, recipe);
      }
    } catch (err: any) {
      console.error('Error persisting updated matches:', err);
      setError(err.message || 'Error al persistir favoritos actualizados');
    }
  }, [favorites, setError, user?.uid]);

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback(async (recipe: RecipeUi) => {
    if (isFavorite(recipe.id)) {
      await removeFavorite(recipe.id);
    } else {
      await addFavorite(recipe);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  /**
   * Clear all favorites
   */
  const clearAllFavorites = useCallback(async () => {
    try {
      const favoriteRecipesCollection = database.get<FavoriteRecipe>('favorite_recipes');
      const allFavorites = await favoriteRecipesCollection.query().fetch();

      await database.write(async () => {
        for (const fav of allFavorites) {
          await fav.destroyPermanently();
        }
      });

      setFavorites([]);

      console.log('All favorites cleared');
    } catch (err: any) {
      console.error('Error clearing favorites:', err);
      setError(err.message || 'Error al limpiar favoritos');
    }
  }, [setFavorites, setError]);

  /**
   * Load favorites on mount
   */
  useEffect(() => {
    if (!user?.uid) {
      hasSyncedRef.current = null;
      setFavorites([]);
      return;
    }

    loadFavorites();
  }, [loadFavorites, setFavorites, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    if (hasSyncedRef.current === user.uid) return;

    hasSyncedRef.current = user.uid;
    syncFavorites();
  }, [syncFavorites, user?.uid]);

  useEffect(() => {
    if (favorites.length === 0) return;

    const updatedFavorites = favorites.map((recipe) => {
      const { matchPercentage, matchedIngredients, missingIngredients } =
        calculateRecipeMatch(recipe, inventoryItems);

      return {
        ...recipe,
        matchPercentage,
        matchedIngredients,
        missingIngredients,
      };
    });

    const hasChanges = updatedFavorites.some((recipe, index) => {
      const current = favorites[index];
      if (!current) return true;

      return (
        current.matchPercentage !== recipe.matchPercentage ||
        JSON.stringify(current.matchedIngredients || []) !==
          JSON.stringify(recipe.matchedIngredients || []) ||
        JSON.stringify(current.missingIngredients || []) !==
          JSON.stringify(recipe.missingIngredients || [])
      );
    });

    if (hasChanges) {
      setFavorites(updatedFavorites);
    }
  }, [favorites, inventoryItems, setFavorites]);

  return {
    favorites,
    loading,
    error,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearAllFavorites,
    loadFavorites,
    syncFavorites,
    persistUpdatedMatches,
  };
}
