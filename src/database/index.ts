import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import FoodItem from './models/FoodItem';
import ParsedDraft from './models/ParsedDraft';
import RecipeCache from './models/RecipeCache';
import Ingredient from './models/Ingredient';

/**
 * Initialize WatermelonDB database
 * Equivalent to Room Database setup in Android app
 */

// Create SQLite adapter
const adapter = new SQLiteAdapter({
  schema,
  // Optional: Enable JSI for better performance (requires Expo dev client)
  jsi: false,
  // Optional: Enable migrations
  // migrations,
});

// Create database instance
export const database = new Database({
  adapter,
  modelClasses: [FoodItem, ParsedDraft, RecipeCache, Ingredient],
});

/**
 * Database collections shortcuts
 */
export const collections = {
  foodItems: database.get<FoodItem>('food_items'),
  parsedDrafts: database.get<ParsedDraft>('parsed_drafts'),
  recipeCache: database.get<RecipeCache>('recipe_cache'),
  ingredients: database.get<Ingredient>('ingredients'),
};

export default database;
