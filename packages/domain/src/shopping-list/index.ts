import type { SnapshotIngredient } from "../favorites/index";

export interface ShoppingLine { ingredientKey: string | null; name: string; quantity: number | null; unit: string | null }
const key = (line: ShoppingLine) => `${line.ingredientKey ?? line.name.trim().toLocaleLowerCase("es")}|${line.unit?.trim().toLocaleLowerCase("es") ?? "?"}`;

export function aggregateShoppingLines(lines: readonly ShoppingLine[]): ShoppingLine[] {
  const result = new Map<string, ShoppingLine>();
  for (const line of lines) {
    const current = result.get(key(line));
    const compatible = current && current.quantity !== null && line.quantity !== null && current.unit !== null && line.unit !== null;
    result.set(key(line), compatible ? { ...current, quantity: current.quantity! + line.quantity! } : current ?? { ...line });
  }
  return [...result.values()];
}

export function missingFromSnapshot(snapshot: readonly SnapshotIngredient[], available: ReadonlyMap<string, number>): ShoppingLine[] {
  return snapshot.filter((line) => !line.ingredientKey || line.quantity === null || (available.get(line.ingredientKey) ?? 0) < line.quantity)
    .map((line) => ({ ingredientKey: line.ingredientKey, name: line.name, quantity: line.quantity === null ? null : Math.max(0, line.quantity - (line.ingredientKey ? available.get(line.ingredientKey) ?? 0 : 0)), unit: line.unit }));
}

