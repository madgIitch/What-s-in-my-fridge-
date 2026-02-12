import { create } from 'zustand';
import { RecipeUi } from '../database/models/RecipeCache';

export interface ShoppingItem {
  ingredientName: string;
  neededBy: string[];
  recipeNames: string[];
  checked: boolean;
}

interface ShoppingListStore {
  items: ShoppingItem[];
  showChecked: boolean;
  generateFromFavorites: (favorites: RecipeUi[]) => void;
  toggleItem: (ingredientName: string) => void;
  clearChecked: () => void;
  uncheckItems: (ingredientNames: string[]) => void;
  setShowChecked: (show: boolean) => void;
}

const normalize = (value: string): string => value.toLowerCase().trim();

export const useShoppingListStore = create<ShoppingListStore>((set, get) => ({
  items: [],
  showChecked: true,

  generateFromFavorites: (favorites) => {
    const ingredientMap = new Map<string, ShoppingItem>();
    const previousChecked = new Map(
      get().items.map((item) => [normalize(item.ingredientName), item.checked])
    );

    for (const recipe of favorites) {
      const missingIngredients = Array.isArray(recipe.missingIngredients)
        ? recipe.missingIngredients
        : [];

      for (const ingredient of missingIngredients) {
        const normalized = normalize(ingredient);
        if (!normalized) continue;

        const existing = ingredientMap.get(normalized);
        if (existing) {
          if (!existing.neededBy.includes(recipe.id)) {
            existing.neededBy.push(recipe.id);
          }
          if (!existing.recipeNames.includes(recipe.name)) {
            existing.recipeNames.push(recipe.name);
          }
        } else {
          ingredientMap.set(normalized, {
            ingredientName: ingredient.trim(),
            neededBy: [recipe.id],
            recipeNames: [recipe.name],
            checked: previousChecked.get(normalized) || false,
          });
        }
      }
    }

    const items = Array.from(ingredientMap.values()).sort((a, b) =>
      a.ingredientName.localeCompare(b.ingredientName, 'es')
    );

    set({ items });
  },

  toggleItem: (ingredientName) => {
    const target = normalize(ingredientName);
    set((state) => ({
      items: state.items.map((item) =>
        normalize(item.ingredientName) === target
          ? { ...item, checked: !item.checked }
          : item
      ),
    }));
  },

  clearChecked: () => {
    set((state) => ({
      items: state.items.map((item) => ({ ...item, checked: false })),
    }));
  },

  uncheckItems: (ingredientNames) => {
    const targets = new Set(ingredientNames.map(normalize));
    set((state) => ({
      items: state.items.map((item) =>
        targets.has(normalize(item.ingredientName))
          ? { ...item, checked: false }
          : item
      ),
    }));
  },

  setShowChecked: (show) => set({ showChecked: show }),
}));
