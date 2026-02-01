import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * FavoriteRecipe Model - User's favorite recipes
 * Stores complete recipe data for offline access
 */
export default class FavoriteRecipe extends Model {
  static table = 'favorite_recipes';

  @field('recipe_id') recipeId!: string; // Unique identifier for the recipe
  @field('name') name!: string;
  @field('match_percentage') matchPercentage!: number;
  @field('matched_ingredients') matchedIngredients!: string; // JSON array
  @field('missing_ingredients') missingIngredients!: string; // JSON array
  @field('ingredients_with_measures') ingredientsWithMeasures!: string; // JSON array
  @field('instructions') instructions!: string;
  @field('user_id') userId!: string; // For Firestore sync
  @field('saved_at') savedAt!: number; // Timestamp when favorited

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Get matched ingredients as array
   */
  get matchedIngredientsArray(): string[] {
    try {
      if (!this.matchedIngredients || this.matchedIngredients.trim() === '') {
        return [];
      }
      return JSON.parse(this.matchedIngredients);
    } catch (error) {
      console.error('Error parsing matchedIngredients:', error);
      return [];
    }
  }

  /**
   * Get missing ingredients as array
   */
  get missingIngredientsArray(): string[] {
    try {
      if (!this.missingIngredients || this.missingIngredients.trim() === '') {
        return [];
      }
      return JSON.parse(this.missingIngredients);
    } catch (error) {
      console.error('Error parsing missingIngredients:', error);
      return [];
    }
  }

  /**
   * Get ingredients with measures as array
   */
  get ingredientsWithMeasuresArray(): string[] {
    try {
      if (!this.ingredientsWithMeasures || this.ingredientsWithMeasures.trim() === '') {
        return [];
      }
      return JSON.parse(this.ingredientsWithMeasures);
    } catch (error) {
      console.error('Error parsing ingredientsWithMeasures:', error);
      return [];
    }
  }

  /**
   * Convert to RecipeUi format for display
   */
  toRecipeUi() {
    return {
      id: this.recipeId,
      name: this.name,
      matchPercentage: this.matchPercentage,
      matchedIngredients: this.matchedIngredientsArray,
      missingIngredients: this.missingIngredientsArray,
      ingredientsWithMeasures: this.ingredientsWithMeasuresArray,
      instructions: this.instructions,
    };
  }

  /**
   * Get how long ago this recipe was favorited
   */
  get daysAgo(): number {
    const now = Date.now();
    const diff = now - this.savedAt;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}
