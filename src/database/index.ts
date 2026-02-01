import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import migrations from './migrations';
import FoodItem from './models/FoodItem';
import ParsedDraft from './models/ParsedDraft';
import RecipeCache from './models/RecipeCache';
import FavoriteRecipe from './models/FavoriteRecipe';
import Ingredient from './models/Ingredient';
import IngredientMapping from './models/IngredientMapping';
import MealEntry from './models/MealEntry';

/**
 * Initialize WatermelonDB database
 * Equivalent to Room Database setup in Android app
 */

// Create SQLite adapter
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  // Optional: Enable JSI for better performance (requires Expo dev client)
  jsi: false,
});

// Create database instance
export const database = new Database({
  adapter,
  modelClasses: [
    FoodItem,
    ParsedDraft,
    RecipeCache,
    FavoriteRecipe,
    Ingredient,
    IngredientMapping,
    MealEntry,
  ],
});

/**
 * Database collections shortcuts
 */
export const collections = {
  foodItems: database.get<FoodItem>('food_items'),
  parsedDrafts: database.get<ParsedDraft>('parsed_drafts'),
  recipeCache: database.get<RecipeCache>('recipe_cache'),
  favoriteRecipes: database.get<FavoriteRecipe>('favorite_recipes'),
  ingredients: database.get<Ingredient>('ingredients'),
  ingredientMappings: database.get<IngredientMapping>('ingredient_mappings'),
  mealEntries: database.get<MealEntry>('meal_entries'),
};

export default database;
