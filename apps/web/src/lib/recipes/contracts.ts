import type { RecipeSuggestion } from "./matcher";

export interface RecipeSuggestionsResponse {
  contract: "recipe-suggestions-v1";
  recipes: RecipeSuggestion[];
  inventoryHash: string;
  catalogVersion: string;
  matcherVersion: string;
  inventoryEmpty: boolean;
  cache: { hit: boolean; expiresAt: string };
}

export type RecipeSuggestionErrorCode = "AUTH_REQUIRED" | "INVALID_REQUEST" | "CATALOG_NOT_READY" | "INVENTORY_INVALID" | "SUGGESTION_QUOTA_EXHAUSTED" | "SUGGESTION_FAILED";

const statuses: Record<RecipeSuggestionErrorCode, number> = { AUTH_REQUIRED: 401, INVALID_REQUEST: 400, CATALOG_NOT_READY: 409, INVENTORY_INVALID: 422, SUGGESTION_QUOTA_EXHAUSTED: 429, SUGGESTION_FAILED: 500 };
export function recipeError(code: RecipeSuggestionErrorCode, message: string, retryable = false) {
  return Response.json({ code, message, retryable }, { status: statuses[code] });
}
