import type { PantryItemKnowledge } from "../pantry/knowledge";

export const TODAY_CONTRACT = "today-v2" as const;
export const TODAY_RECOMMENDATION_VERSION = "today-ranking-v3" as const;
export const TODAY_CACHE_TTL_MINUTES = 60;

export type CanonicalUnit = "g" | "ml" | "unit" | "pack";
export type AvailabilityState = "ready" | "quantity_to_check" | "missing_one" | "missing_many" | "unknown";
export type FreshnessSignal = "verified" | "estimated" | "none";
export type TodayReasonCode = "have_all" | "quantity_check" | "missing" | "unknown" | "use_soon_verified" | "use_soon_estimated" | "favorite";

export type FoodConceptInput = Readonly<{ id: string; displayName: string; aliases?: readonly string[] }>;
export type TodayPantryItem = PantryItemKnowledge & Readonly<{
  deletedAt?: string | null;
  normalizationStatus?: "unknown" | "proposed" | "confirmed";
}>;
export type TodayRecipeIngredient = Readonly<{
  name: string;
  normalizedName?: string | null;
  measure?: string | null;
  foodConceptId?: string | null;
}>;
export type TodayRecipeInput = Readonly<{
  recipeId: string;
  name: string;
  ingredients: readonly TodayRecipeIngredient[];
  favorite?: boolean;
}>;
export type IngredientDecision = Readonly<{
  conceptId: string | null;
  name: string;
  availability: "have_enough" | "have_presence_unknown_amount" | "missing" | "unknown";
  deficitQuantity: number | null;
  unit: CanonicalUnit | null;
}>;
export type TodayReason = Readonly<{ code: TodayReasonCode; ingredient?: string }>;
export type TodayDecision = Readonly<{
  recipeId: string;
  name: string;
  availability: AvailabilityState;
  missingCount: number;
  unknownCount: number;
  quantityToCheck: boolean;
  missingIngredients: readonly string[];
  unknownIngredients: readonly string[];
  reasons: readonly TodayReason[];
  freshness: FreshnessSignal;
  shopping: readonly IngredientDecision[];
}>;

type ParsedQuantity = Readonly<{ quantity: number; unit: CanonicalUnit }>;

// Sum the decimal values received from the DB/parser without binary rounding
// turning 0.1 + 0.2 into a false shortage against an exact stock of 0.3.
function sumDecimal(values: readonly number[]): number {
  const parts = values.map((value) => {
    const [mantissa, exponent = "0"] = value.toString().split("e");
    const decimals = mantissa.split(".")[1]?.length ?? 0;
    return { coefficient: BigInt(mantissa.replace(".", "")), scale: decimals - Number(exponent) };
  });
  const scale = Math.max(0, ...parts.map((part) => part.scale));
  const total = parts.reduce((sum, part) => sum + part.coefficient * BigInt(10) ** BigInt(scale - part.scale), BigInt(0));
  return Number(`${total}e-${scale}`);
}

export function normalizeTodayText(value: string): string {
  return value.toLocaleLowerCase("es-ES").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function parseRecipeQuantity(measure: string | null | undefined): ParsedQuantity | null {
  if (!measure) return null;
  const match = measure.trim().toLocaleLowerCase("es-ES").match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|unidad|unidades|unit|pack|packs)$/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  const rawUnit = match[2];
  if (rawUnit === "kg" || rawUnit === "l") {
    const quantity = value * 1000;
    return Number.isFinite(quantity) ? { quantity, unit: rawUnit === "kg" ? "g" : "ml" } : null;
  }
  if (rawUnit === "unidad" || rawUnit === "unidades" || rawUnit === "unit") return { quantity: value, unit: "unit" };
  if (rawUnit === "pack" || rawUnit === "packs") return { quantity: value, unit: "pack" };
  return { quantity: value, unit: rawUnit as "g" | "ml" };
}

function civilDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const result = Date.UTC(year, month - 1, day) / 86_400_000;
  const date = new Date(result * 86_400_000);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? result : null;
}

function canonicalStock(item: TodayPantryItem): ParsedQuantity | null {
  if (item.stock.mode !== "exact" || item.stock.quantity <= 0) return null;
  return parseRecipeQuantity(`${item.stock.quantity} ${item.stock.unit}`);
}

function positive(item: TodayPantryItem): boolean {
  if (item.deletedAt || item.normalizationStatus !== "confirmed") return false;
  if (!item.foodConceptId) return false;
  if (item.stock.mode === "presence") return item.stock.state === "present";
  if (item.stock.mode === "qualitative") return item.stock.state !== "empty";
  return item.stock.quantity > 0 && item.stock.state !== "empty";
}

function conceptLookup(concepts: readonly FoodConceptInput[]) {
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  const byName = new Map<string, Set<string>>();
  for (const concept of concepts) {
    for (const value of [concept.displayName, ...(concept.aliases ?? [])]) {
      const normalized = normalizeTodayText(value);
      if (!normalized) continue;
      const ids = byName.get(normalized) ?? new Set<string>();
      ids.add(concept.id); byName.set(normalized, ids);
    }
  }
  return { byId, byName };
}

function resolveIngredientConcept(ingredient: TodayRecipeIngredient, lookup: ReturnType<typeof conceptLookup>): string | null {
  if (ingredient.foodConceptId && lookup.byId.has(ingredient.foodConceptId)) return ingredient.foodConceptId;
  const ids = lookup.byName.get(normalizeTodayText(ingredient.normalizedName || ingredient.name));
  return ids?.size === 1 ? [...ids][0] : null;
}

function freshnessForConcept(items: readonly TodayPantryItem[], today: string): FreshnessSignal {
  const todayDay = civilDay(today);
  if (todayDay === null) return "none";
  let estimated = false;
  for (const item of items.filter(positive)) {
    if (item.freshness.precision === "exact" && ["package", "user", "retailer"].includes(item.freshness.source)) {
      const expiry = civilDay(item.freshness.expiryDateExact);
      if (expiry !== null && expiry >= todayDay && expiry <= todayDay + 2) return "verified";
    }
    if (item.freshness.precision === "estimated" && item.freshness.acquiredOn
      && ["package", "user", "retailer", "receipt", "catalog"].includes(item.freshness.source)
      && Number.isFinite(item.freshness.windowDays) && item.freshness.windowDays > 0) {
      const acquired = civilDay(item.freshness.acquiredOn);
      const end = acquired === null ? null : acquired + item.freshness.windowDays;
      if (end !== null && end >= todayDay && end <= todayDay + 2) estimated = true;
    }
  }
  return estimated ? "estimated" : "none";
}

function evaluateConceptGroup(
  conceptId: string,
  ingredients: readonly TodayRecipeIngredient[],
  pantry: readonly TodayPantryItem[],
  conceptName: string,
): IngredientDecision {
  const available = pantry.filter((item) => item.foodConceptId === conceptId && positive(item));
  const parsed = ingredients.map((ingredient) => parseRecipeQuantity(ingredient.measure));
  if (available.length === 0) {
    return { conceptId, name: conceptName, availability: "missing", deficitQuantity: null, unit: null };
  }
  if (parsed.some((entry) => entry === null)) return { conceptId, name: conceptName, availability: "have_presence_unknown_amount", deficitQuantity: null, unit: null };
  const units = new Set(parsed.map((entry) => entry!.unit));
  if (units.size !== 1) return { conceptId, name: conceptName, availability: "unknown", deficitQuantity: null, unit: null };
  const unit = parsed[0]!.unit;
  const required = sumDecimal(parsed.map((entry) => entry!.quantity));
  const exact = available.map(canonicalStock).filter((entry): entry is ParsedQuantity => entry !== null);
  const invalidExactCount = available.filter((item) => item.stock.mode === "exact" && canonicalStock(item) === null).length;
  const compatible = sumDecimal(exact.filter((entry) => entry.unit === unit).map((entry) => entry.quantity));
  if (compatible >= required) return { conceptId, name: conceptName, availability: "have_enough", deficitQuantity: null, unit };
  if (available.some((item) => item.stock.mode !== "exact")) return { conceptId, name: conceptName, availability: "have_presence_unknown_amount", deficitQuantity: null, unit: null };
  if (invalidExactCount > 0 || exact.some((entry) => entry.unit !== unit)) return { conceptId, name: conceptName, availability: "unknown", deficitQuantity: null, unit: null };
  return { conceptId, name: conceptName, availability: "missing", deficitQuantity: sumDecimal([required, -compatible]), unit };
}

export function evaluateTodayRecipe(input: {
  recipe: TodayRecipeInput;
  pantry: readonly TodayPantryItem[];
  concepts: readonly FoodConceptInput[];
  today: string;
}): TodayDecision {
  const lookup = conceptLookup(input.concepts);
  const grouped = new Map<string, TodayRecipeIngredient[]>();
  const unresolved: IngredientDecision[] = [];
  for (const ingredient of input.recipe.ingredients) {
    const conceptId = resolveIngredientConcept(ingredient, lookup);
    if (!conceptId) {
      unresolved.push({ conceptId: null, name: ingredient.name, availability: "unknown", deficitQuantity: null, unit: null });
      continue;
    }
    grouped.set(conceptId, [...(grouped.get(conceptId) ?? []), ingredient]);
  }
  const decisions = [...grouped].map(([conceptId, ingredients]) => evaluateConceptGroup(
    conceptId, ingredients, input.pantry, lookup.byId.get(conceptId)!.displayName,
  )).concat(unresolved);
  const missing = decisions.filter((decision) => decision.availability === "missing");
  const unknown = decisions.filter((decision) => decision.availability === "unknown");
  const quantityToCheck = decisions.some((decision) => decision.availability === "have_presence_unknown_amount");
  const availability: AvailabilityState = missing.length > 1 ? "missing_many" : missing.length === 1 ? "missing_one"
    : unknown.length > 0 ? "unknown" : quantityToCheck ? "quantity_to_check" : "ready";
  let freshness: FreshnessSignal = "none";
  let freshnessIngredient: string | undefined;
  for (const conceptId of grouped.keys()) {
    const signal = freshnessForConcept(input.pantry.filter((item) => item.foodConceptId === conceptId), input.today);
    if (signal === "verified" || (signal === "estimated" && freshness === "none")) {
      freshness = signal; freshnessIngredient = lookup.byId.get(conceptId)?.displayName;
      if (signal === "verified") break;
    }
  }
  const reasons: TodayReason[] = [
    { code: availability === "ready" ? "have_all" : availability === "quantity_to_check" ? "quantity_check" : availability === "unknown" ? "unknown" : "missing" },
    ...(freshness === "verified" ? [{ code: "use_soon_verified" as const, ingredient: freshnessIngredient }]
      : freshness === "estimated" ? [{ code: "use_soon_estimated" as const, ingredient: freshnessIngredient }] : []),
    ...(input.recipe.favorite ? [{ code: "favorite" as const }] : []),
  ];
  return {
    recipeId: input.recipe.recipeId, name: input.recipe.name, availability,
    missingCount: missing.length, unknownCount: unknown.length, quantityToCheck,
    missingIngredients: missing.map((item) => item.name), unknownIngredients: unknown.map((item) => item.name),
    reasons, freshness, shopping: missing,
  };
}

const availabilityOrder: Record<AvailabilityState, number> = { ready: 0, quantity_to_check: 1, missing_one: 2, missing_many: 3, unknown: 4 };
const freshnessOrder: Record<FreshnessSignal, number> = { verified: 0, estimated: 1, none: 2 };

export function rankTodayDecisions(decisions: readonly TodayDecision[]): TodayDecision[] {
  return [...decisions].sort((left, right) => availabilityOrder[left.availability] - availabilityOrder[right.availability]
    || (left.availability === "missing_many" && right.availability === "missing_many" ? left.missingCount - right.missingCount : 0)
    || left.unknownCount - right.unknownCount
    || freshnessOrder[left.freshness] - freshnessOrder[right.freshness]
    || Number(!left.reasons.some((reason) => reason.code === "favorite")) - Number(!right.reasons.some((reason) => reason.code === "favorite"))
    || (left.recipeId < right.recipeId ? -1 : left.recipeId > right.recipeId ? 1 : 0));
}

export function selectTodayDecisions(decisions: readonly TodayDecision[]) {
  const ranked = rankTodayDecisions(decisions);
  const main = ranked.slice(0, 3);
  const mainIds = new Set(main.map((decision) => decision.recipeId));
  const secondary = ranked.filter((decision) => !mainIds.has(decision.recipeId) && decision.freshness !== "none" && decision.availability !== "unknown").slice(0, 3);
  return { main, secondary };
}

/** Stable JSON projection used before hashing server-side cache inputs. */
export function todayCacheProjection(input: Record<string, unknown>): string {
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, stable(item)]))
      : value;
  return JSON.stringify(stable(input));
}
