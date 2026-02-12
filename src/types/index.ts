/**
 * Core types for What's In My Fridge app
 */

import type { RecipeUi } from '../database/models/RecipeCache';

// Expiry state for food items
export type ExpiryState = 'OK' | 'SOON' | 'EXPIRED';

// Source of food item
export type FoodItemSource = 'manual' | 'ocr';

// Navigation types
// Root stack navigator types (navegación con FABs)
export type RootStackParamList = {
  Login: undefined;
  HomeTab: undefined;
  ScanTab: undefined;
  RecipesTab: undefined;
  FavoritesTab: undefined;
  SettingsTab: undefined;
  CalendarTab: undefined;
  ReviewDraft: { draftId: string };
  Detail: { itemId: string };
  AddItem: undefined;
  Crop: { imageUri: string; onCropComplete: (uri: string) => void };
  AddMeal: {
    prefillIngredientIds?: string[];
    prefillName?: string;
    prefillMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    prefillConsumedAt?: number;
  } | undefined;
  MealDetail: { mealId: string };
  RecipeSteps: { recipe: RecipeUi };
  ConsumeIngredients: undefined;
  ConsumeRecipeIngredients: {
    recipeName: string;
    matchedIngredients: string[];
    ingredientsWithMeasures: string[];
  };
  AddRecipeFromUrl: undefined;
  ShoppingList: undefined;
  Paywall:
    | {
        source?:
          | 'recipes'
          | 'recipes_limit'
          | 'url_recipes'
          | 'ocr'
          | 'settings';
      }
    | undefined;
};

// Mantener para compatibilidad con componentes existentes
export type MainTabParamList = {
  HomeTab: undefined;
  ScanTab: undefined;
  RecipesTab: undefined;
  CalendarTab: undefined;
  SettingsTab: undefined;
};

// Food categories
export const FOOD_CATEGORIES = [
  'Lácteos',
  'Carnes',
  'Pescados',
  'Frutas',
  'Verduras',
  'Granos',
  'Agua',
  'Jugos',
  'Refrescos',
  'Café y Té',
  'Vinos',
  'Cervezas',
  'Licores',
  'Snacks',
  'Condimentos',
  'Aceites',
  'Harinas',
  'Huevos',
  'Frutos Secos',
  'Embutidos',
  'Congelados',
  'Conservas',
  'Salsas',
  'Postres',
  'Pan',
  'Platos preparados',
  'Otros',
] as const;

export type FoodCategory = typeof FOOD_CATEGORIES[number];

// Units
export const FOOD_UNITS = ['unidad', 'kg', 'g', 'litros', 'ml', 'paquete', 'porción'] as const;

export type FoodUnit = typeof FOOD_UNITS[number];

// Default units by category
export const DEFAULT_UNITS_BY_CATEGORY: Record<FoodCategory, FoodUnit> = {
  'Lácteos': 'litros',        // Leche, yogurt líquidos
  'Carnes': 'kg',              // Peso para carnes
  'Pescados': 'kg',            // Peso para pescados
  'Frutas': 'kg',              // Peso para frutas
  'Verduras': 'kg',            // Peso para verduras
  'Granos': 'kg',              // Arroz, pasta, legumbres
  'Agua': 'litros',            // Agua embotellada
  'Jugos': 'litros',           // Jugos de frutas
  'Refrescos': 'litros',       // Sodas, refrescos
  'Café y Té': 'g',            // Café molido, té en gramos
  'Vinos': 'litros',           // Vinos (botellas)
  'Cervezas': 'litros',        // Cervezas (botellas/latas)
  'Licores': 'litros',         // Licores destilados
  'Snacks': 'paquete',         // Snacks empaquetados
  'Condimentos': 'g',          // Especias, sal en gramos
  'Aceites': 'litros',         // Aceites líquidos
  'Harinas': 'kg',             // Harina en peso
  'Huevos': 'unidad',          // Huevos por unidad
  'Frutos Secos': 'g',         // Frutos secos en gramos
  'Embutidos': 'g',            // Embutidos en gramos/lonchas
  'Congelados': 'kg',          // Productos congelados por peso
  'Conservas': 'unidad',       // Latas/botes por unidad
  'Salsas': 'ml',              // Salsas líquidas
  'Postres': 'unidad',         // Postres por unidad
  'Pan': 'unidad',             // Pan por unidad/barra
  'Platos preparados': 'porción', // Porciones
  'Otros': 'unidad',           // Por defecto unidad
};

// Kitchen utensils
export const KITCHEN_UTENSILS = [
  'oven',
  'stove',
  'microwave',
  'blender',
  'mixer',
  'air-fryer',
  'slow-cooker',
  'pressure-cooker',
] as const;

export type KitchenUtensil = typeof KITCHEN_UTENSILS[number];

// Currency
export type Currency = 'EUR' | 'USD' | 'GBP';

// Subscription tier
export type SubscriptionTier = 'Free' | 'Pro';

// Recipe limits by tier
export const RECIPE_LIMITS: Record<SubscriptionTier, number> = {
  Free: 10,
  Pro: 100,
};

// Helper function to get default unit for a category
export const getDefaultUnitForCategory = (category?: string): FoodUnit => {
  if (!category) return 'unidad';

  const foodCategory = category as FoodCategory;
  return DEFAULT_UNITS_BY_CATEGORY[foodCategory] || 'unidad';
};
