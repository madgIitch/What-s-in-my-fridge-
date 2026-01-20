import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * ParsedItem - Individual item from OCR scan
 * Stored as JSON in ParsedDraft.linesJson
 */
export interface ParsedItem {
  name: string;
  quantity: number;
  price?: number;
  expiryDate?: string;
  category?: string;
}

/**
 * ParsedDraft Model - OCR scan draft pending review
 * Equivalent to ParsedDraftEntity from Android Room Database
 */
export default class ParsedDraft extends Model {
  static table = 'parsed_drafts';

  @field('raw_text') rawText!: string; // Full OCR extracted text
  @field('timestamp') timestamp!: number;
  @field('merchant') merchant?: string; // Store/merchant name
  @field('purchase_date') purchaseDate?: string;
  @field('currency') currency!: string; // Default: 'EUR'
  @field('total') total?: number; // Receipt total amount
  @field('lines_json') linesJson!: string; // JSON array of ParsedItem[]
  @field('unrecognized_lines') unrecognizedLines!: string; // JSON array of string[]
  @field('confirmed') confirmed!: boolean; // Whether draft was confirmed

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  /**
   * Get parsed items as array
   */
  get items(): ParsedItem[] {
    try {
      return JSON.parse(this.linesJson);
    } catch (error) {
      console.error('Error parsing linesJson:', error);
      return [];
    }
  }

  /**
   * Get unrecognized lines as array
   */
  get unrecognizedLinesArray(): string[] {
    try {
      return JSON.parse(this.unrecognizedLines);
    } catch (error) {
      console.error('Error parsing unrecognizedLines:', error);
      return [];
    }
  }

  /**
   * Get formatted timestamp
   */
  get timestampFormatted(): string {
    return new Date(this.timestamp).toLocaleString();
  }

  /**
   * Get number of items in draft
   */
  get itemCount(): number {
    return this.items.length;
  }
}
