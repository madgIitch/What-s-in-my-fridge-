/** Shared domain primitives. Business behavior moves here only as its sprint is approved. */
export type EntityId = string;

export type LegacyReference = Readonly<{
  source: "FIREBASE";
  legacyId: string;
}>;

export type OwnedEntity = Readonly<{
  id: EntityId;
  userId: EntityId;
  source: "APP" | "FIREBASE";
  legacyId: string | null;
  deletedAt: string | null;
  version: number;
}>;

export type NewOwnedEntity = Readonly<{
  id?: EntityId;
  userId: EntityId;
  source?: "APP" | "FIREBASE";
  legacyId?: string | null;
  deletedAt?: string | null;
  version?: number;
}>;

export type InventoryItem = OwnedEntity & Readonly<{
  name: string; normalizedName: string | null; expiryDate: string;
  category: string | null; quantity: number; notes: string | null;
  unit: string; addedAt: string;
}>;
export type InventoryItemInsert = NewOwnedEntity & Omit<InventoryItem, keyof OwnedEntity>;

export type InventoryMutationOperation = "create" | "update" | "delete";
export type InventorySyncState = "synced" | "pending" | "conflict" | "error";
export type InventoryMutationCode =
  | "OK"
  | "SYNC_CONFLICT"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR";

export type InventoryMutationPayload = Readonly<{
  name?: string;
  normalizedName?: string | null;
  expiryDate?: string;
  category?: string | null;
  quantity?: number;
  notes?: string | null;
  unit?: string;
  addedAt?: string;
}>;

export type InventoryMutation = Readonly<{
  clientMutationId: EntityId;
  userId: EntityId;
  operation: InventoryMutationOperation;
  itemId: EntityId;
  payload: InventoryMutationPayload;
  expectedVersion: number | null;
  state: Exclude<InventorySyncState, "synced">;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError: InventoryMutationCode | "NETWORK_ERROR" | null;
}>;

export type InventoryMutationResult = Readonly<{
  client_mutation_id: EntityId;
  status: "applied" | "duplicate" | "conflict" | "rejected";
  code: InventoryMutationCode;
  item: Record<string, unknown> | null;
}>;

/** A civil date is stored and displayed verbatim; it must never pass through Date. */
export function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

export type ReceiptLine = Readonly<{ name: string; quantity: number; price?: number; expiryDate?: string; category?: string }>;
export type ReceiptDraft = OwnedEntity & Readonly<{
  rawText: string; capturedAt: string; merchant: string | null;
  purchaseDate: string | null; currency: string; total: number | null;
  lines: readonly ReceiptLine[]; unrecognizedLines: readonly string[]; confirmed: boolean;
}>;
export type ReceiptDraftInsert = NewOwnedEntity & Omit<ReceiptDraft, keyof OwnedEntity>;

export type FavoriteRecipe = OwnedEntity & Readonly<{
  recipeId: string; name: string; matchPercentage: number;
  matchedIngredients: readonly string[]; missingIngredients: readonly string[];
  ingredientsWithMeasures: readonly string[]; instructions: string; savedAt: string;
}>;
export type FavoriteRecipeInsert = NewOwnedEntity & Omit<FavoriteRecipe, keyof OwnedEntity>;

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealEntry = OwnedEntity & Readonly<{
  mealType: MealType; mealDate: string; recipeId: string | null;
  customName: string | null; ingredientsConsumed: readonly EntityId[];
  notes: string | null; caloriesEstimate: number | null; consumedAt: string;
}>;
export type MealEntryInsert = NewOwnedEntity & Omit<MealEntry, keyof OwnedEntity>;

export type IngredientMapping = OwnedEntity & Readonly<{
  scannedName: string; normalizedName: string; confidence: number;
  method: "exact" | "synonym" | "partial" | "fuzzy" | "llm" | "user";
  verifiedByUser: boolean; canonical: boolean;
}>;
export type IngredientMappingInsert = NewOwnedEntity & Omit<IngredientMapping, keyof OwnedEntity>;

export type LegacyPayload<T> = Readonly<{ reference: LegacyReference; value: T }>;
