import type { SnapshotIngredient } from "../favorites/index";

export interface InventoryAmount { id: string; ingredientKey: string; quantity: number; unit: string; version: number; expiryDate: string; createdAt: string }
export interface ConsumptionLine { ingredientKey: string; inventoryItemId: string; expectedVersion: number; quantity: number; unit: string }

export function buildFefoPlan(ingredients: SnapshotIngredient[], inventory: InventoryAmount[]): ConsumptionLine[] {
  const plan: ConsumptionLine[] = [];
  for (const ingredient of ingredients) {
    if (!ingredient.ingredientKey || ingredient.quantity === null || !ingredient.unit) throw new Error("INGREDIENT_UNMAPPED");
    let remaining = ingredient.quantity;
    const lots = inventory.filter((item) => item.ingredientKey === ingredient.ingredientKey && item.unit === ingredient.unit)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    for (const lot of lots) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, lot.quantity);
      if (quantity > 0) plan.push({ ingredientKey: ingredient.ingredientKey, inventoryItemId: lot.id, expectedVersion: lot.version, quantity, unit: lot.unit });
      remaining -= quantity;
    }
    if (remaining > 0) throw new Error("INSUFFICIENT_QUANTITY");
  }
  return plan;
}

