/**
 * Core types for What's In My Fridge app
 */

// Expiry state for food items
export type ExpiryState = 'OK' | 'SOON' | 'EXPIRED';

// Source of food item
export type FoodItemSource = 'manual' | 'ocr';

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Scan: undefined;
  ReviewDraft: { draftId: string };
  Detail: { itemId: string };
  AddItem: undefined;
  RecipesPro: undefined;
  Settings: undefined;
};

// Food categories
export const FOOD_CATEGORIES = [
  'Lácteos',
  'Carnes',
  'Pescados',
  'Frutas',
  'Verduras',
  'Granos',
  'Bebidas',
  'Snacks',
  'Condimentos',
  'Otros',
] as const;

export type FoodCategory = typeof FOOD_CATEGORIES[number];

// Units
export const FOOD_UNITS = ['unidad', 'kg', 'g', 'litros', 'ml', 'paquete'] as const;

export type FoodUnit = typeof FOOD_UNITS[number];

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
