import { useCallback, useEffect } from 'react';
import { database } from '../database';
import FavoriteRecipe from '../database/models/FavoriteRecipe';
import { RecipeUi } from '../database/models/RecipeCache';
import { Q } from '@nozbe/watermelondb';
import { useFavoritesStore } from '../stores/useFavoritesStore';
import { useAuthStore } from '../stores/useAuthStore';

/**
 * Hook to manage favorite recipes with WatermelonDB
 */
export function useFavorites() {
  const { favorites, setFavorites, addFavorite: addToStore, removeFavorite: removeFromStore, isFavorite, loading, error, setLoading, setError } = useFavoritesStore();
  const { user } = useAuthStore();

  /**
   * Load all favorite recipes from DB
   */
  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true);
      const favoriteRecipesCollection = database.get<FavoriteRecipe>('favorite_recipes');

      const allFavorites = await favoriteRecipesCollection
        .query()
        .fetch();

      const recipesUi: RecipeUi[] = allFavorites.map((fav) => fav.toRecipeUi());

      setFavorites(recipesUi);
    } catch (err: any) {
      console.error('Error loading favorites:', err);
      setError(err.message || 'Error al cargar favoritos');
    } finally {
      setLoading(false);
    }
  }, [setFavorites, setLoading, setError]);

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
        .query(Q.where('recipe_id', recipe.id))
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
      const favoriteRecipesCollection = database.get<FavoriteRecipe>('favorite_recipes');

      const existing = await favoriteRecipesCollection
        .query(Q.where('recipe_id', recipeId))
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

      // Remove from store
      removeFromStore(recipeId);

      console.log('Recipe removed from favorites');
    } catch (err: any) {
      console.error('Error removing favorite:', err);
      setError(err.message || 'Error al eliminar favorito');
    }
  }, [removeFromStore, setError]);

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
    loadFavorites();
  }, [loadFavorites]);

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
  };
}
