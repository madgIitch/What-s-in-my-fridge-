import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * RecipeUi - Recipe suggestion from Cloud Function
 * Stored as JSON in RecipeCache.recipesJson
 */
export interface RecipeUi {
  id: string;
  name: string;
  matchPercentage: number;
  matchedIngredients: string[];
  missingIngredients: string[];
  ingredientsWithMeasures: string[];
  instructions: string;
}

/**
 * RecipeCache Model - Cached recipe suggestions
 * Equivalent to RecipeCacheEntity from Android Room Database
 */
export default class RecipeCache extends Model {
  static table = 'recipe_cache';

  @field('ingredients_hash') ingredientsHash!: string; // MD5 hash of sorted ingredients
  @field('recipes_json') recipesJson!: string; // JSON array of RecipeUi[]
  @field('timestamp') timestamp!: number;
  @field('ttl_minutes') ttlMinutes!: number; // Time to live in minutes (default: 60)

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Get recipes as array
   */
  get recipes(): RecipeUi[] {
    try {
      return JSON.parse(this.recipesJson);
    } catch (error) {
      console.error('Error parsing recipesJson:', error);
      return [];
    }
  }

  /**
   * Check if cache is expired based on TTL
   */
  get isExpired(): boolean {
    const now = Date.now();
    const expiryTime = this.timestamp + this.ttlMinutes * 60 * 1000;
    return now > expiryTime;
  }

  /**
   * Get expiry timestamp
   */
  get expiresAt(): number {
    return this.timestamp + this.ttlMinutes * 60 * 1000;
  }

  /**
   * Get minutes until expiry
   */
  get minutesUntilExpiry(): number {
    const now = Date.now();
    const expiryTime = this.expiresAt;
    const millisecondsLeft = expiryTime - now;
    return Math.floor(millisecondsLeft / (1000 * 60));
  }

  /**
   * Get number of cached recipes
   */
  get recipeCount(): number {
    return this.recipes.length;
  }
}
