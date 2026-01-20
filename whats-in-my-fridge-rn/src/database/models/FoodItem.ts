import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * FoodItem Model - Main inventory item
 * Equivalent to FoodItemEntity from Android Room Database
 */
export default class FoodItem extends Model {
  static table = 'food_items';

  @field('name') name!: string;
  @field('expiry_date') expiryDate!: number; // Epoch timestamp
  @field('category') category?: string;
  @field('quantity') quantity!: number;
  @field('notes') notes?: string;
  @field('unit') unit!: string;
  @field('expiry_at') expiryAt!: number;
  @field('added_at') addedAt!: number;
  @field('source') source!: 'manual' | 'ocr';

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Calculate expiry state based on days left until expiration
   * Equivalent to ExpiryState calculation in Android app
   */
  get expiryState(): 'OK' | 'SOON' | 'EXPIRED' {
    const daysLeft = this.daysLeft;

    if (daysLeft < 0) return 'EXPIRED';
    if (daysLeft <= 3) return 'SOON';
    return 'OK';
  }

  /**
   * Calculate days left until expiration
   */
  get daysLeft(): number {
    const now = Date.now();
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((this.expiryDate - now) / millisecondsPerDay);
  }

  /**
   * Get formatted expiry date
   */
  get expiryDateFormatted(): string {
    return new Date(this.expiryDate).toLocaleDateString();
  }

  /**
   * Check if item is expired
   */
  get isExpired(): boolean {
    return this.daysLeft < 0;
  }

  /**
   * Check if item is expiring soon (within 3 days)
   */
  get isExpiringSoon(): boolean {
    return this.daysLeft >= 0 && this.daysLeft <= 3;
  }
}
