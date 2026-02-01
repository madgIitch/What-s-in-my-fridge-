import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Database migrations for What's In My Fridge
 *
 * IMPORTANT: Never modify existing migrations, only add new ones
 * Migration history:
 * - v5: Initial schema (migrated from Android Room)
 * - v6: Added ingredient_mappings table
 * - v7: Added normalized_name to food_items
 * - v8: Added favorite_recipes table
 * - v9: Added meal_entries table
 */
export default schemaMigrations({
  migrations: [
    // Migration from version 6 to 7
    // Adds ingredient normalization support
    {
      toVersion: 7,
      steps: [
        // Add normalized_name column to food_items
        // This stores the generic ingredient name for recipe matching
        // Example: "Bio EHL Champignon" → normalizedName: "mushroom"
        addColumns({
          table: 'food_items',
          columns: [
            { name: 'normalized_name', type: 'string', isOptional: true },
          ],
        }),

        // Create ingredient_mappings table for caching normalizations
        // This prevents redundant Cloud Function calls
        createTable({
          name: 'ingredient_mappings',
          columns: [
            { name: 'scanned_name', type: 'string', isIndexed: true }, // Original scanned name
            { name: 'normalized_name', type: 'string', isOptional: true }, // Generic name
            { name: 'confidence', type: 'number' }, // 0-1 confidence score
            { name: 'method', type: 'string' }, // 'exact' | 'synonym' | 'partial' | 'fuzzy' | 'llm' | 'none'
            { name: 'verified_by_user', type: 'boolean' }, // User manually verified
            { name: 'timestamp', type: 'number' }, // Cache timestamp
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // Migration from version 7 to 8
    // Adds favorite recipes support
    {
      toVersion: 8,
      steps: [
        // Create favorite_recipes table
        createTable({
          name: 'favorite_recipes',
          columns: [
            { name: 'recipe_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string' },
            { name: 'match_percentage', type: 'number' },
            { name: 'matched_ingredients', type: 'string' },
            { name: 'missing_ingredients', type: 'string' },
            { name: 'ingredients_with_measures', type: 'string' },
            { name: 'instructions', type: 'string' },
            { name: 'user_id', type: 'string', isIndexed: true },
            { name: 'saved_at', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
    // Migration from version 8 to 9
    // Adds meal entries for calendar tracking
    {
      toVersion: 9,
      steps: [
        createTable({
          name: 'meal_entries',
          columns: [
            { name: 'meal_type', type: 'string' },
            { name: 'meal_date', type: 'number' },
            { name: 'recipe_id', type: 'string', isOptional: true },
            { name: 'custom_name', type: 'string', isOptional: true },
            { name: 'ingredients_consumed', type: 'string' },
            { name: 'notes', type: 'string', isOptional: true },
            { name: 'calories_estimate', type: 'number', isOptional: true },
            { name: 'user_id', type: 'string' },
            { name: 'consumed_at', type: 'number' },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
});
