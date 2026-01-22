import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';

/**
 * Database migrations for What's In My Fridge
 *
 * IMPORTANT: Never modify existing migrations, only add new ones
 * Migration history:
 * - v5: Initial schema (migrated from Android Room)
 * - v6: Added ingredient_mappings table
 * - v7: Added normalized_name to food_items
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
  ],
});
