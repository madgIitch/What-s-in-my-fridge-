import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Database schema for What's In My Fridge app
 * Version 8 - Added favorite_recipes table
 *
 * Tables:
 * - food_items: Main inventory of food items
 * - parsed_drafts: OCR scan drafts pending review
 * - recipe_cache: Cached recipe suggestions from Cloud Functions
 * - favorite_recipes: User's favorite recipes
 * - ingredients: Reference database of ingredients for classification
 * - ingredient_mappings: Cache for scanned ingredient normalization
 */

export const schema = appSchema({
  version: 8,
  tables: [
    // FoodItemEntity - Main inventory table
    tableSchema({
      name: 'food_items',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'normalized_name', type: 'string', isOptional: true }, // Generic ingredient for recipes
        { name: 'expiry_date', type: 'number' }, // Epoch timestamp
        { name: 'category', type: 'string', isOptional: true },
        { name: 'quantity', type: 'number' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'unit', type: 'string' }, // 'unidad', 'kg', 'litros', etc.
        { name: 'expiry_at', type: 'number' }, // Epoch timestamp
        { name: 'added_at', type: 'number' }, // Epoch timestamp
        { name: 'source', type: 'string' }, // 'manual' | 'ocr'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),

    // ParsedDraftEntity - OCR scan drafts
    tableSchema({
      name: 'parsed_drafts',
      columns: [
        { name: 'raw_text', type: 'string' }, // Full OCR text
        { name: 'timestamp', type: 'number' },
        { name: 'merchant', type: 'string', isOptional: true }, // Store name
        { name: 'purchase_date', type: 'string', isOptional: true },
        { name: 'currency', type: 'string' }, // 'EUR', 'USD', etc.
        { name: 'total', type: 'number', isOptional: true }, // Receipt total
        { name: 'lines_json', type: 'string' }, // JSON array of ParsedItem[]
        { name: 'unrecognized_lines', type: 'string' }, // JSON array of String[]
        { name: 'confirmed', type: 'boolean' }, // Whether draft was confirmed
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),

    // RecipeCacheEntity - Cached recipe suggestions
    tableSchema({
      name: 'recipe_cache',
      columns: [
        { name: 'ingredients_hash', type: 'string', isIndexed: true }, // Hash of ingredient list
        { name: 'recipes_json', type: 'string' }, // JSON array of RecipeUi[]
        { name: 'timestamp', type: 'number' },
        { name: 'ttl_minutes', type: 'number' }, // Time to live in minutes
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),

    // FavoriteRecipeEntity - User's favorite recipes
    tableSchema({
      name: 'favorite_recipes',
      columns: [
        { name: 'recipe_id', type: 'string', isIndexed: true }, // Unique recipe identifier
        { name: 'name', type: 'string' },
        { name: 'match_percentage', type: 'number' },
        { name: 'matched_ingredients', type: 'string' }, // JSON array
        { name: 'missing_ingredients', type: 'string' }, // JSON array
        { name: 'ingredients_with_measures', type: 'string' }, // JSON array
        { name: 'instructions', type: 'string' },
        { name: 'user_id', type: 'string', isIndexed: true }, // For Firestore sync
        { name: 'saved_at', type: 'number' }, // Timestamp when favorited
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),

    // IngredientEntity - Reference database for food classification
    tableSchema({
      name: 'ingredients',
      columns: [
        { name: 'name', type: 'string', isIndexed: true }, // Ingredient name
        { name: 'category', type: 'string' }, // 'protein', 'vegetable', 'grain', etc.
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    }),

    // IngredientMapping - Cache for ingredient normalization
    tableSchema({
      name: 'ingredient_mappings',
      columns: [
        { name: 'scanned_name', type: 'string', isIndexed: true }, // Original OCR name
        { name: 'normalized_name', type: 'string', isOptional: true }, // Normalized generic name
        { name: 'confidence', type: 'number' }, // Confidence score 0-1
        { name: 'method', type: 'string' }, // 'exact' | 'synonym' | 'partial' | 'fuzzy' | 'llm' | 'none'
        { name: 'verified_by_user', type: 'boolean' }, // User manually verified
        { name: 'timestamp', type: 'number' }, // Cache timestamp
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' }
      ]
    })
  ]
});
