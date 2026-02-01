import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * MealEntry Model - Calendar meal entry
 */
export default class MealEntry extends Model {
  static table = 'meal_entries';

  @field('meal_type') mealType!: MealType;
  @field('meal_date') mealDate!: number; // Start of day timestamp
  @field('recipe_id') recipeId?: string;
  @field('custom_name') customName?: string;
  @field('ingredients_consumed') ingredientsConsumed!: string; // JSON array of food_item IDs
  @field('notes') notes?: string;
  @field('calories_estimate') caloriesEstimate?: number;
  @field('user_id') userId!: string;
  @field('consumed_at') consumedAt!: number;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  get ingredientsConsumedArray(): string[] {
    try {
      if (!this.ingredientsConsumed || this.ingredientsConsumed.trim() === '') {
        return [];
      }
      return JSON.parse(this.ingredientsConsumed);
    } catch (error) {
      console.error('Error parsing ingredientsConsumed:', error);
      return [];
    }
  }
}
