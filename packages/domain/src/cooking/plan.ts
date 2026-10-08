import { recipeAvailability, type CookRecipe } from '../recipes/availability';
import { parseRecipeQuantity, type FoodConceptInput } from '../recommendations/today';

export type CookingSource = { kind: 'catalog' | 'import' | 'favorite'; id: string };
export type CookingLot = { id: string; name: string; version: number; food_concept_id: string | null; normalization_status: string; deleted_at: string | null; stock_mode: string; stock_state: string | null; quantity_precision: string; quantity_exact: number | null; quantity_unit: string | null; expiry_date_exact: string | null; freshness_precision?: string; freshness_source?: string | null; created_at: string };
export type Allocation = { inventoryItemId: string; name: string; version: number; mode: string; state: string | null; quantity: number | null; unit: string | null; consumption: number; after: number | null };
export type CookingChoice = { lineId: string; action: 'apply' | 'keep' | 'set_state' | 'set_consumption'; inventoryItemId?: string; state?: 'plenty' | 'low' | 'empty'; quantity?: number; unit?: string };
export type CookingLineV3 = { lineId: string; name: string; conceptId: string | null; mode: 'exact' | 'qualitative' | 'unresolved'; originalAmount: string | null; originalUnit: string | null; before: string; proposedAfter: string; allowedActions: CookingChoice['action'][]; allocations: Allocation[]; required: number | null; requiredUnit: string | null; insufficient: boolean };
export type CookingPlan = { contract: 'cooking-plan-v1'; sourceRef: CookingSource; recipeVersion: string; planKey: string; computedAt: string; expiresAt: string; recipe: Pick<CookRecipe, 'title' | 'ingredients' | 'steps' | 'reviewRequired'>; lines: CookingLineV3[] };
export type CookingResult = { contract: 'cooking-mutation-v1'; status: 'applied' | 'duplicate'; eventId: string; appliedAt: string; undoUntil: string; changes: { inventoryItemId: string; name: string; before: Record<string, unknown>; after: Record<string, unknown>; beforeVersion: number; afterVersion: number; provenance: string }[]; undone?: boolean };

// Decimal addition/subtraction preserves the quantities provided by the parser.
export function decimalSum(values: number[]) {
  const parts = values.map(value => { const [m, e = '0'] = value.toString().split('e'); return { n: BigInt(m.replace('.', '')), s: (m.split('.')[1]?.length ?? 0) - Number(e) }; });
  const scale = Math.max(0, ...parts.map(p => p.s));
  return Number(`${parts.reduce((n, p) => n + p.n * BigInt(10) ** BigInt(scale - p.s), BigInt(0))}e-${scale}`);
}
export function buildCookingPlan(recipe: CookRecipe, lots: CookingLot[], concepts: FoodConceptInput[]): CookingLineV3[] {
  const rows = recipeAvailability(recipe, [], concepts, '2026-01-01').ingredients;
  const groups = new Map<string, typeof rows>();
  for (const row of rows) { const group = groups.get(row.groupKey) ?? []; group.push(row); groups.set(row.groupKey, group); }
  return [...groups.entries()].map(([key, group]) => {
    const first = group[0]; const units = new Set(group.map(r => r.amount_unit));
    const required = group.every(r => r.amount_status === 'exact') && units.size === 1 ? decimalSum(group.map(r => r.amount_value!)) : null;
    const requiredUnit = required === null ? null : first.amount_unit;
    const available = lots.filter(l => first.conceptId && l.food_concept_id === first.conceptId && l.normalization_status === 'confirmed' && !l.deleted_at && !['empty', 'absent'].includes(l.stock_state ?? '') && (l.stock_mode === 'exact' ? l.quantity_precision === 'exact' && Number(l.quantity_exact) > 0 : l.stock_mode === 'qualitative' ? ['plenty', 'some', 'low'].includes(l.stock_state ?? '') : l.stock_state === 'present'))
      .sort((a, b) => verifiedExpiry(a).localeCompare(verifiedExpiry(b)) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    const parsed = available.map(l => l.stock_mode === 'exact' && l.quantity_precision === 'exact' ? parseRecipeQuantity(`${l.quantity_exact} ${l.quantity_unit}`) : null);
    const compatible = required !== null && available.length > 0 && parsed.every(p => p && p.unit === requiredUnit);
    const total = compatible ? decimalSum(parsed.map(p => p!.quantity)) : 0;
    const exact = compatible && total >= required!;
    const qualitative = available.length === 1 && available[0].stock_mode === 'qualitative';
    let remaining = exact ? required! : 0;
    const allocations = available.map((lot, index) => {
      const p = parsed[index]; const canonical = p?.quantity ?? null;
      const consumption = exact ? Math.min(remaining, canonical!) : 0;
      remaining = decimalSum([remaining, -consumption]);
      return { inventoryItemId: lot.id, name: lot.name, version: lot.version, mode: lot.stock_mode, state: lot.stock_state, quantity: canonical, unit: p?.unit ?? null, consumption, after: canonical === null ? null : decimalSum([canonical, -consumption]) };
    });
    const before = exact ? `${total} ${requiredUnit}` : available.length === 1 ? allocations[0].quantity !== null ? `${allocations[0].quantity} ${allocations[0].unit}` : stateLabel(allocations[0].state) : available.length ? `${available.length} lotes · elige cuál` : 'Sin lote identificado';
    return { lineId: key, name: first.name, conceptId: first.conceptId, mode: exact ? 'exact' : qualitative ? 'qualitative' : 'unresolved', originalAmount: group.map(r => r.originalAmount).filter(Boolean).join(' + ') || null, originalUnit: first.originalUnit, before,
      proposedAfter: exact ? `${decimalSum([total, -required!])} ${requiredUnit}` : qualitative ? stateLabel(available[0].stock_state === 'low' ? 'empty' : 'low') : 'Sin cambios',
      allowedActions: available.length ? ['keep', ...(exact || qualitative ? ['apply' as const] : []), 'set_state', ...(parsed.some(Boolean) ? ['set_consumption' as const] : [])] : ['keep'], allocations, required, requiredUnit, insufficient: compatible && !exact };
  });
}
function verifiedExpiry(lot: CookingLot) { return lot.freshness_precision === 'exact' && ['user', 'package', 'retailer'].includes(lot.freshness_source ?? '') ? lot.expiry_date_exact ?? '9999-12-31' : '9999-12-31'; }
export function stateLabel(state: string | null) { return ({ plenty: 'Queda bastante', some: 'Queda bastante', low: 'Queda poco', empty: 'Se acabó', present: 'Lo tienes', absent: 'Se acabó' } as Record<string, string>)[state ?? ''] ?? 'Cantidad por comprobar'; }
export function defaultChoices(plan: CookingPlan): CookingChoice[] { return plan.lines.map(l => ({ lineId: l.lineId, action: l.mode === 'exact' || l.mode === 'qualitative' ? 'apply' : 'keep' })); }
export function choicePreview(line: CookingLineV3, choice: CookingChoice) {
  if (choice.action === 'keep') return 'Sin cambios';
  if (choice.action === 'apply') return line.proposedAfter;
  if (choice.action === 'set_state') return stateLabel(choice.state ?? null);
  const lots = choice.inventoryItemId ? line.allocations.filter(l => l.inventoryItemId === choice.inventoryItemId) : line.allocations;
  const total = decimalSum(lots.map(l => l.quantity ?? 0));
  return `${decimalSum([total, -(choice.quantity ?? 0)])} ${choice.unit ?? ''}`;
}
