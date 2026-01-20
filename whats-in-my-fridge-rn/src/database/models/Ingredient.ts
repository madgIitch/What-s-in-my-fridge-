import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * Ingredient Model - Reference database for food classification
 * Equivalent to IngredientEntity from Android Room Database
 */
export default class Ingredient extends Model {
  static table = 'ingredients';

  @field('name') name!: string; // Ingredient name (normalized, lowercase)
  @field('category') category!: string; // 'protein', 'vegetable', 'grain', 'dairy', etc.

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Get capitalized ingredient name
   */
  get nameCapitalized(): string {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1);
  }
}
