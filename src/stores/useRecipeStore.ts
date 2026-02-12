import { create } from 'zustand';
import { RecipeUi } from '../database/models/RecipeCache';

/**
 * Recipe Store - Manages recipe suggestions state
 * Equivalent to RecipesProVm + RecipeCacheRepository from Android app
 */
interface RecipeStore {
  recipes: RecipeUi[];
  loading: boolean;
  error: string | null;
  lastFetchTime: number | null;

  // Actions
  setRecipes: (recipes: RecipeUi[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastFetchTime: (time: number) => void;
  clearError: () => void;
  clearRecipes: () => void;
}

export const useRecipeStore = create<RecipeStore>((set) => ({
  recipes: [],
  loading: false,
  error: null,
  lastFetchTime: null,

  setRecipes: (recipes) => {
    console.log('📦 [RecipeStore] setRecipes called with', recipes.length, 'recipes');
    set({ recipes, lastFetchTime: Date.now(), error: null });
  },

  setLoading: (loading) => {
    console.log(`🔄 [RecipeStore] setLoading called with: ${loading}`);
    set({ loading });
  },

  setError: (error) => {
    console.log('❌ [RecipeStore] setError called:', error);
    set({ error });
  },

  setLastFetchTime: (time) => set({ lastFetchTime: time }),

  clearError: () => set({ error: null }),

  clearRecipes: () => set({ recipes: [], lastFetchTime: null }),
}));
