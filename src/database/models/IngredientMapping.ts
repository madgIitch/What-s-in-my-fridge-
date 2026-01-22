import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

/**
 * IngredientMapping Model - Cache for ingredient normalization
 * Maps scanned ingredient names (e.g., "Bio EHL Champignon") to normalized names (e.g., "mushroom")
 *
 * This cache prevents redundant Cloud Function calls for ingredients we've already normalized
 */
export default class IngredientMapping extends Model {
  static table = 'ingredient_mappings';

  /**
   * The original scanned name from OCR or user input
   * Example: "Bio EHL Champignon", "Salchichas Oscar Mayer"
   */
  @field('scanned_name') scannedName!: string;

  /**
   * The normalized generic ingredient name
   * Example: "mushroom", "sausage"
   * Can be null if normalization failed
   */
  @field('normalized_name') normalizedName!: string | null;

  /**
   * Confidence score from normalization algorithm (0-1)
   * 1.0 = exact match, 0.95 = synonym, 0.8 = partial, 0.5-0.8 = fuzzy, 0.85 = LLM
   */
  @field('confidence') confidence!: number;

  /**
   * Method used for normalization
   * - exact: Direct match in vocabulary
   * - synonym: Match in synonyms list
   * - partial: Scanned name contains normalized name
   * - fuzzy: Levenshtein similarity > 0.75
   * - llm: LLM fallback (Ollama)
   * - none: No normalization found
   */
  @field('method') method!: 'exact' | 'synonym' | 'partial' | 'fuzzy' | 'llm' | 'none';

  /**
   * Whether the user has manually verified/corrected this normalization
   * Allows users to correct wrong normalizations
   */
  @field('verified_by_user') verifiedByUser!: boolean;

  /**
   * Timestamp when this mapping was created
   * Used for cache invalidation
   */
  @field('timestamp') timestamp!: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Check if this mapping is still valid (not too old)
   * Mappings older than 30 days should be refreshed
   */
  get isValid(): boolean {
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    return Date.now() - this.timestamp < thirtyDaysInMs;
  }

  /**
   * Check if this mapping has high confidence (>= 0.8)
   */
  get isHighConfidence(): boolean {
    return this.confidence >= 0.8;
  }
}
