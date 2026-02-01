import { create } from 'zustand';
import { RecipeUi } from '../database/models/RecipeCache';

/**
 * Favorites Store - Manages favorite recipes state
 */
interface FavoritesStore {
  favorites: RecipeUi[];
  favoriteIds: Set<string>; // For quick lookup
  loading: boolean;
  error: string | null;

  // Actions
  setFavorites: (favorites: RecipeUi[]) => void;
  addFavorite: (recipe: RecipeUi) => void;
  removeFavorite: (recipeId: string) => void;
  isFavorite: (recipeId: string) => boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  favoriteIds: new Set<string>(),
  loading: false,
  error: null,

  setFavorites: (favorites) => {
    const favoriteIds = new Set(favorites.map((recipe) => recipe.id));
    set({ favorites, favoriteIds, error: null });
  },

  addFavorite: (recipe) => {
    const { favorites, favoriteIds } = get();

    // Don't add if already exists
    if (favoriteIds.has(recipe.id)) {
      return;
    }

    const newFavorites = [recipe, ...favorites];
    const newIds = new Set(favoriteIds);
    newIds.add(recipe.id);

    set({ favorites: newFavorites, favoriteIds: newIds });
  },

  removeFavorite: (recipeId) => {
    const { favorites, favoriteIds } = get();

    const newFavorites = favorites.filter((recipe) => recipe.id !== recipeId);
    const newIds = new Set(favoriteIds);
    newIds.delete(recipeId);

    set({ favorites: newFavorites, favoriteIds: newIds });
  },

  isFavorite: (recipeId) => {
    return get().favoriteIds.has(recipeId);
  },

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  clearError: () => set({ error: null }),
}));
