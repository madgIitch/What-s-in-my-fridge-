import { isCivilDate, type InventoryItem } from "../index";

export type KnowledgeProvenance = "package" | "user" | "retailer" | "receipt" | "legacy";
export type StockState = "plenty" | "some" | "low" | "empty";

export type StockKnowledge =
  | Readonly<{ mode: "presence"; state: "present" | "absent" }>
  | Readonly<{ mode: "qualitative"; state: StockState }>
  | Readonly<{ mode: "exact"; quantity: number; unit: string; state?: StockState }>;

export type FreshnessKnowledge =
  | Readonly<{ precision: "unknown" }>
  | Readonly<{ precision: "estimated"; source: KnowledgeProvenance; acquiredOn?: string; windowDays?: number }>
  | Readonly<{ precision: "exact"; expiryDateExact: string; source: "package" | "user" | "retailer" }>;

export type PantryItemKnowledge = Readonly<{
  id: string;
  foodConceptId: string | null;
  commercialProductId: string | null;
  displayName: string;
  stock: StockKnowledge;
  freshness: FreshnessKnowledge;
  legacyQuantity?: number;
  legacyExpiryDate?: string;
}>;

export type IngredientAvailability = "have_enough" | "have_presence_unknown_amount" | "missing" | "unknown";
export type RecipeAvailability = Readonly<{
  ingredients: readonly IngredientAvailability[];
  state: "ready" | "quantity_to_check" | "missing" | "unknown";
  missingCount: number;
}>;

export function validatePantryKnowledge(item: PantryItemKnowledge): boolean {
  if (!item.id || !item.displayName.trim()) return false;
  if (item.stock.mode === "exact") {
    if (!Number.isFinite(item.stock.quantity) || item.stock.quantity < 0 || !item.stock.unit.trim()) return false;
    if (item.stock.quantity === 0 && item.stock.state && item.stock.state !== "empty") return false;
    if (item.stock.quantity > 0 && item.stock.state === "empty") return false;
  }
  if (item.freshness.precision === "estimated") {
    if (!item.freshness.source || item.freshness.source === "legacy") return false;
    if (item.freshness.acquiredOn && !isCivilDate(item.freshness.acquiredOn)) return false;
    if (item.freshness.windowDays !== undefined && (!Number.isFinite(item.freshness.windowDays) || item.freshness.windowDays < 0)) return false;
  }
  if (item.freshness.precision === "exact" && !isCivilDate(item.freshness.expiryDateExact)) return false;
  return true;
}

/** Legacy quantity and expiry are retained as evidence, never promoted to exact knowledge. */
export function projectLegacyInventoryItem(item: InventoryItem): PantryItemKnowledge {
  return {
    id: item.id,
    foodConceptId: null,
    commercialProductId: null,
    displayName: item.name,
    stock: { mode: "presence", state: "present" },
    freshness: { precision: "unknown" },
    legacyQuantity: item.quantity,
    legacyExpiryDate: item.expiryDate,
  };
}

export function ingredientAvailability(
  item: PantryItemKnowledge | null,
  required?: Readonly<{ quantity: number; unit: string }> | null,
): IngredientAvailability {
  if (!item) return "missing";
  if (item.stock.mode === "presence") return item.stock.state === "absent" ? "missing" : "have_presence_unknown_amount";
  if (item.stock.mode === "qualitative") return item.stock.state === "empty" ? "missing" : "have_presence_unknown_amount";
  if (item.stock.quantity === 0) return "missing";
  if (!required || !Number.isFinite(required.quantity) || required.quantity < 0) return "have_presence_unknown_amount";
  if (item.stock.unit !== required.unit) return "unknown";
  return item.stock.quantity >= required.quantity ? "have_enough" : "missing";
}

export function recipeAvailability(ingredients: readonly IngredientAvailability[]): RecipeAvailability {
  const missingCount = ingredients.filter((item) => item === "missing").length;
  const state = missingCount > 0 ? "missing"
    : ingredients.includes("unknown") ? "unknown"
      : ingredients.includes("have_presence_unknown_amount") ? "quantity_to_check"
        : "ready";
  return { ingredients, state, missingCount };
}
