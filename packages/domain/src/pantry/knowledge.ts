import { isCivilDate, type InventoryItem } from "../index";

export type KnowledgeProvenance = "package" | "user" | "retailer" | "receipt" | "catalog";
export type StockState = "plenty" | "some" | "low" | "empty";
export type NormalizationKnowledge =
  | Readonly<{ status: "unknown" }>
  | Readonly<{ status: "proposed" | "confirmed"; foodConceptId: string; source: "user" | "catalog" | "receipt" | "barcode" }>;

export type FoodConcept = Readonly<{ id: string; slug: string; displayName: string; category: string | null }>;
export type CommercialProduct = Readonly<{ id: string; retailer: string; retailerProductId: string | null; barcode: string | null; displayName: string; foodConceptId: string | null }>;

export type StockKnowledge =
  | Readonly<{ mode: "presence"; quantityPrecision: "unknown"; state: "present" | "absent" | "unknown" }>
  | Readonly<{ mode: "qualitative"; quantityPrecision: "unknown"; state: StockState }>
  | Readonly<{ mode: "exact"; quantityPrecision: "exact"; quantity: number; unit: string; state?: StockState }>;

export type FreshnessKnowledge =
  | Readonly<{ precision: "unknown" }>
  | Readonly<{ precision: "estimated"; source: KnowledgeProvenance; acquiredOn?: string; windowDays: number }>
  | Readonly<{ precision: "exact"; expiryDateExact: string; source: "package" | "user" | "retailer" }>;

export type PantryItemKnowledge = Readonly<{
  id: string;
  foodConceptId: string | null;
  commercialProductId: string | null;
  displayName: string;
  stock: StockKnowledge;
  freshness: FreshnessKnowledge;
  knowledgeProvenance?: "legacy" | "user" | "receipt" | "retailer" | "package";
  normalization?: NormalizationKnowledge;
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
  const stock = item.stock as unknown as Record<string, unknown>;
  const freshness = item.freshness as unknown as Record<string, unknown>;
  if (!["presence", "qualitative", "exact"].includes(item.stock.mode) || !["unknown", "estimated", "exact"].includes(item.freshness.precision)) return false;
  if (item.stock.mode === "presence" && (item.stock.quantityPrecision !== "unknown" || !["present", "absent", "unknown"].includes(item.stock.state) || "quantity" in stock || "unit" in stock)) return false;
  if (item.stock.mode === "qualitative" && (item.stock.quantityPrecision !== "unknown" || !["plenty", "some", "low", "empty"].includes(item.stock.state) || "quantity" in stock || "unit" in stock)) return false;
  if (item.stock.mode === "exact") {
    if (item.stock.quantityPrecision !== "exact") return false;
    if (item.stock.state && !["plenty", "some", "low", "empty"].includes(item.stock.state)) return false;
    if (!Number.isFinite(item.stock.quantity) || item.stock.quantity < 0 || !item.stock.unit.trim()) return false;
    if (item.stock.quantity === 0 && item.stock.state && item.stock.state !== "empty") return false;
    if (item.stock.quantity > 0 && item.stock.state === "empty") return false;
  }
  if (item.freshness.precision === "unknown" && ("source" in freshness || "windowDays" in freshness || "expiryDateExact" in freshness)) return false;
  if (item.freshness.precision === "estimated") {
    if (!item.freshness.source || !["package", "user", "retailer", "receipt", "catalog"].includes(item.freshness.source)) return false;
    if (item.freshness.acquiredOn && !isCivilDate(item.freshness.acquiredOn)) return false;
    if (!Number.isFinite(item.freshness.windowDays) || item.freshness.windowDays < 0) return false;
    if ("expiryDateExact" in freshness) return false;
  }
  if (item.freshness.precision === "exact" && (!isCivilDate(item.freshness.expiryDateExact) || !["package", "user", "retailer"].includes(item.freshness.source) || "windowDays" in freshness)) return false;
  return true;
}

/** Legacy quantity and expiry are retained as evidence, never promoted to exact knowledge. */
export function projectLegacyInventoryItem(item: InventoryItem): PantryItemKnowledge {
  return {
    id: item.id,
    foodConceptId: null,
    commercialProductId: null,
    displayName: item.name,
    stock: { mode: "presence", quantityPrecision: "unknown", state: "unknown" },
    freshness: { precision: "unknown" },
    knowledgeProvenance: "legacy",
    normalization: { status: "unknown" },
    legacyQuantity: item.quantity,
    legacyExpiryDate: item.expiryDate,
  };
}

export function ingredientAvailability(
  item: PantryItemKnowledge | null,
  required?: Readonly<{ quantity: number; unit: string }> | null,
): IngredientAvailability {
  if (!item) return "missing";
  if (!validatePantryKnowledge(item)) return "unknown";
  if (item.stock.mode === "presence") return item.stock.state === "absent" ? "missing" : item.stock.state === "unknown" ? "unknown" : "have_presence_unknown_amount";
  if (item.stock.mode === "qualitative") return item.stock.state === "empty" ? "missing" : "have_presence_unknown_amount";
  if (item.stock.quantity === 0) return "missing";
  if (!required || !Number.isFinite(required.quantity) || required.quantity < 0) return "have_presence_unknown_amount";
  if (item.stock.unit !== required.unit) return "unknown";
  return item.stock.quantity >= required.quantity ? "have_enough" : "missing";
}

export function recipeAvailability(ingredients: readonly IngredientAvailability[]): RecipeAvailability {
  const missingCount = ingredients.filter((item) => item === "missing").length;
  const state = missingCount > 0 ? "missing"
    : ingredients.length === 0 || ingredients.includes("unknown") ? "unknown"
      : ingredients.includes("have_presence_unknown_amount") ? "quantity_to_check"
        : "ready";
  return { ingredients, state, missingCount };
}
