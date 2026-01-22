// Estructura compatible con ParsedDraftEntity de Android
export interface ParsedDraftEntity {
  rawText: string;
  merchant: string | null;
  purchaseDate: string | null;
  currency: string;
  total: number | null;
  linesJson: string; // JSON serializado de ParsedItem[]
  unrecognizedLines: string; // JSON serializado de string[]
}

// Estructura compatible con ParsedItem de Android
export interface ParsedItem {
  name: string;
  quantity: number;
  price: number | null;
  expiryDate?: string;
  category?: string;
}

// Estructura de receta
export interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  ingredientsNormalized?: string[];
  ingredientsWithMeasures?: string[];
  minIngredients: number;
  instructions?: string[];
}

// Resultado de matching
export interface RecipeMatch {
  recipe: Recipe;
  matchedIngredients: string[];
  matchPercentage: number;
  missingCount: number;
}
