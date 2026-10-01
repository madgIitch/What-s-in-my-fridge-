export type TodayAvailability = "ready" | "quantity_to_check" | "missing_one" | "missing_many" | "unknown";
export type TodayState = "ready" | "empty_pantry" | "unresolved_pantry" | "no_candidates";
export type TodayReasonCode = "have_all" | "quantity_check" | "missing" | "unknown" | "use_soon_verified" | "use_soon_estimated" | "favorite";

export interface TodayRecipe {
  recipeId: string;
  name: string;
  availability: TodayAvailability;
  missingCount: number;
  unknownCount: number;
  quantityToCheck: boolean;
  missingIngredients: string[];
  unknownIngredients: string[];
  reasons: Array<{ code: TodayReasonCode; ingredient?: string }>;
}

export interface TodayResponse {
  contract: "today-v2";
  date: string;
  generatedAt: string;
  state: TodayState;
  main: TodayRecipe[];
  secondary: TodayRecipe[];
  snapshotKey: string;
  catalogVersion: string;
  matcherVersion: string;
  recommendationVersion: string;
}

export type TodayErrorCode = "AUTH_REQUIRED" | "INVALID_REQUEST" | "CATALOG_NOT_READY" | "TODAY_UNAVAILABLE";
export type ShoppingErrorCode = "INVALID_REQUEST" | "AUTH_REQUIRED" | "RECIPE_NOT_FOUND" | "SNAPSHOT_CONFLICT" | "MUTATION_CONFLICT" | "SHOPPING_UNAVAILABLE";

export function recommendationError(code: TodayErrorCode, message: string, status: number, retryable = false) {
  return Response.json({ code, message, retryable }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function shoppingError(code: ShoppingErrorCode, message: string, status: number, retryable = false) {
  return Response.json({ code, message, retryable }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

