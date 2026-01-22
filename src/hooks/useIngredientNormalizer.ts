import { Q } from '@nozbe/watermelondb';
import { database, collections } from '../database';
import {
  normalizeScannedIngredient as normalizeWithCloudFunction,
  NormalizationResult,
} from '../services/firebase/functions';

/**
 * Custom hook for ingredient normalization with local caching
 *
 * Strategy:
 * 1. Check local cache (WatermelonDB) first
 * 2. If not cached or expired, call Cloud Function
 * 3. Cache the result for future use
 *
 * This prevents redundant Cloud Function calls and improves performance
 */
export const useIngredientNormalizer = () => {
  /**
   * Normalize a scanned ingredient name to its generic form
   *
   * @param scannedName - The scanned ingredient name (e.g., "Bio EHL Champignon")
   * @param useLlmFallback - Whether to use LLM fallback for low-confidence matches (default: false)
   * @returns Normalized ingredient name and confidence score
   *
   * @example
   * const { normalizeIngredient } = useIngredientNormalizer();
   * const result = await normalizeIngredient("Bio EHL Champignon");
   * // { scannedName: "Bio EHL Champignon", normalizedName: "mushroom", confidence: 0.8, method: "partial" }
   */
  const normalizeIngredient = async (
    scannedName: string,
    useLlmFallback: boolean = false
  ): Promise<NormalizationResult> => {
    const scannedLower = scannedName.toLowerCase().trim();

    // 1. Check local cache first
    try {
      const cached = await collections.ingredientMappings
        .query(Q.where('scanned_name', scannedLower))
        .fetch();

      if (cached.length > 0) {
        const mapping = cached[0];

        // Check if cache is still valid (not expired)
        if (mapping.isValid) {
          console.log(`✅ Cache hit for "${scannedName}" → "${mapping.normalizedName}"`);
          return {
            scannedName,
            normalizedName: mapping.normalizedName,
            confidence: mapping.confidence,
            method: mapping.method,
          };
        } else {
          console.log(`⏰ Cache expired for "${scannedName}", refreshing...`);
          // Cache expired, delete and fetch new
          await database.write(async () => {
            await mapping.destroyPermanently();
          });
        }
      }
    } catch (error) {
      console.error('Error checking cache:', error);
      // Continue to Cloud Function if cache check fails
    }

    // 2. Cache miss or expired - call Cloud Function
    console.log(`📡 Calling Cloud Function for "${scannedName}"...`);

    const result = await normalizeWithCloudFunction(scannedName, useLlmFallback);

    // 3. Save to cache
    try {
      await database.write(async () => {
        await collections.ingredientMappings.create((mapping) => {
          mapping.scannedName = scannedLower;
          mapping.normalizedName = result.normalizedName;
          mapping.confidence = result.confidence;
          mapping.method = result.method;
          mapping.verifiedByUser = false;
          mapping.timestamp = Date.now();
        });
      });

      console.log(`💾 Cached normalization: "${scannedName}" → "${result.normalizedName}"`);
    } catch (error) {
      console.error('Error caching normalization:', error);
      // Don't fail if caching fails, just return the result
    }

    return result;
  };

  /**
   * Normalize multiple ingredients in batch
   * More efficient than calling normalizeIngredient multiple times
   *
   * @param scannedNames - Array of scanned ingredient names
   * @param useLlmFallback - Whether to use LLM fallback for low-confidence matches (default: false)
   * @returns Array of normalization results
   */
  const normalizeIngredientsBatch = async (
    scannedNames: string[],
    useLlmFallback: boolean = false
  ): Promise<NormalizationResult[]> => {
    // For now, just normalize one by one
    // Could be optimized to batch Cloud Function calls for uncached items
    const results: NormalizationResult[] = [];

    for (const name of scannedNames) {
      const result = await normalizeIngredient(name, useLlmFallback);
      results.push(result);
    }

    return results;
  };

  /**
   * Get a cached normalization without calling Cloud Function
   * Returns null if not cached
   *
   * @param scannedName - The scanned ingredient name
   * @returns Cached normalization result or null
   */
  const getCachedNormalization = async (
    scannedName: string
  ): Promise<NormalizationResult | null> => {
    const scannedLower = scannedName.toLowerCase().trim();

    try {
      const cached = await collections.ingredientMappings
        .query(Q.where('scanned_name', scannedLower))
        .fetch();

      if (cached.length > 0) {
        const mapping = cached[0];

        if (mapping.isValid) {
          return {
            scannedName,
            normalizedName: mapping.normalizedName,
            confidence: mapping.confidence,
            method: mapping.method,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting cached normalization:', error);
      return null;
    }
  };

  /**
   * Manually verify/correct a normalization
   * Useful for allowing users to correct wrong normalizations
   *
   * @param scannedName - The scanned ingredient name
   * @param correctedNormalizedName - The correct normalized name
   */
  const verifyNormalization = async (
    scannedName: string,
    correctedNormalizedName: string
  ): Promise<void> => {
    const scannedLower = scannedName.toLowerCase().trim();

    try {
      await database.write(async () => {
        // Find existing mapping
        const cached = await collections.ingredientMappings
          .query(Q.where('scanned_name', scannedLower))
          .fetch();

        if (cached.length > 0) {
          // Update existing mapping
          const mapping = cached[0];
          await mapping.update(() => {
            mapping.normalizedName = correctedNormalizedName;
            mapping.verifiedByUser = true;
            mapping.confidence = 1.0; // User verification = 100% confidence
            mapping.timestamp = Date.now(); // Refresh timestamp
          });
        } else {
          // Create new verified mapping
          await collections.ingredientMappings.create((mapping) => {
            mapping.scannedName = scannedLower;
            mapping.normalizedName = correctedNormalizedName;
            mapping.confidence = 1.0;
            mapping.method = 'exact';
            mapping.verifiedByUser = true;
            mapping.timestamp = Date.now();
          });
        }
      });

      console.log(`✅ Verified normalization: "${scannedName}" → "${correctedNormalizedName}"`);
    } catch (error) {
      console.error('Error verifying normalization:', error);
      throw error;
    }
  };

  /**
   * Clear all cached normalizations
   * Useful for debugging or resetting the cache
   */
  const clearCache = async (): Promise<void> => {
    try {
      await database.write(async () => {
        const allMappings = await collections.ingredientMappings.query().fetch();
        for (const mapping of allMappings) {
          await mapping.destroyPermanently();
        }
      });

      console.log('🗑️ Cleared all cached normalizations');
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  };

  return {
    normalizeIngredient,
    normalizeIngredientsBatch,
    getCachedNormalization,
    verifyNormalization,
    clearCache,
  };
};
