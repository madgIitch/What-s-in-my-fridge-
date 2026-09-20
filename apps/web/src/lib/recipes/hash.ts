import { createHash } from "node:crypto";
import { normalizeIngredient, type MatcherInventoryItem } from "./matcher";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function recipeInventoryHash(items: MatcherInventoryItem[]): string {
  const normalized = items.map((item) => ({ id: item.id, name: normalizeIngredient(item.name), category: item.category ?? null, quantity: item.quantity ?? null, unit: item.unit ?? null })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(canonical(normalized)).digest("hex");
}

export function recipeCacheKey(inventoryHash: string, catalogVersion: string, matcherVersion: string): string {
  return createHash("sha256").update(canonical({ catalogVersion, inventoryHash, matcherVersion })).digest("hex");
}
