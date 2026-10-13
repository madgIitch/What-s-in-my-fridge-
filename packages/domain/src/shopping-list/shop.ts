/** R5 shopping loop. Pure rules shared by the UI and mirrored (and tested) against the SQL contract. */
export type ShopSourceKind = 'recipe_missing' | 'plan_missing' | 'low_stock_suggestion' | 'manual' | 'legacy';
export type ShopSelection = 'selected' | 'suggested' | 'dismissed';
export type ShopSection = 'recipes' | 'suggestions' | 'manual';

export interface ShopSourceRef {
  source: ShopSourceKind;
  ref: Record<string, unknown>;
  label: string | null;
  quantity: number | null;
  unit: string | null;
}
export interface ShopItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  conceptId: string | null;
  checked: boolean;
  selection: ShopSelection;
  source: ShopSourceKind;
  purchasedAt: string | null;
  version: number;
  createdAt?: string;
  sources: ShopSourceRef[];
  pending?: boolean;
}

const UNIT_ALIASES: Record<string, { base: string; factor: number }> = {
  g: { base: 'g', factor: 1 }, gr: { base: 'g', factor: 1 }, gramo: { base: 'g', factor: 1 }, gramos: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 }, kilo: { base: 'g', factor: 1000 }, kilos: { base: 'g', factor: 1000 },
  ml: { base: 'ml', factor: 1 }, mililitro: { base: 'ml', factor: 1 }, mililitros: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 }, lt: { base: 'ml', factor: 1000 }, litro: { base: 'ml', factor: 1000 }, litros: { base: 'ml', factor: 1000 },
  cl: { base: 'ml', factor: 10 },
  u: { base: 'unit', factor: 1 }, ud: { base: 'unit', factor: 1 }, uds: { base: 'unit', factor: 1 }, unidad: { base: 'unit', factor: 1 },
  unidades: { base: 'unit', factor: 1 }, unit: { base: 'unit', factor: 1 }, units: { base: 'unit', factor: 1 }, pieza: { base: 'unit', factor: 1 }, piezas: { base: 'unit', factor: 1 },
  pack: { base: 'pack', factor: 1 }, packs: { base: 'pack', factor: 1 }, paquete: { base: 'pack', factor: 1 }, paquetes: { base: 'pack', factor: 1 },
};

/** Weight/volume convert inside their own family only; no density, pack or unit guesses. */
export function canonicalUnit(unit: string | null | undefined): { base: string | null; factor: number } {
  const key = (unit ?? '').trim().toLocaleLowerCase('es');
  if (!key) return { base: null, factor: 1 };
  return UNIT_ALIASES[key] ?? { base: key, factor: 1 };
}

/** Items merge only with the same resolved concept and a provably compatible unit. Null when never mergeable. */
export function normalizeShopName(value: string): string {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Resolved concepts group by id; unresolved items only by an identical normalized name, never by similarity. */
export function mergeKey(item: Pick<ShopItem, 'name' | 'conceptId' | 'quantity' | 'unit' | 'checked' | 'selection' | 'purchasedAt'>): string | null {
  if (item.selection !== 'selected' || item.purchasedAt) return null;
  const identity = item.conceptId ?? `n:${normalizeShopName(item.name)}`;
  if (!identity || identity === 'n:') return null;
  return [identity, canonicalUnit(item.unit).base ?? '', item.quantity === null ? 'unknown' : 'exact', item.checked ? 'checked' : 'open'].join('|');
}

export function canMerge(a: ShopItem, b: ShopItem): boolean {
  const key = mergeKey(a);
  return key !== null && key === mergeKey(b);
}

export function sectionOf(item: Pick<ShopItem, 'source'>): ShopSection {
  return item.source === 'recipe_missing' || item.source === 'plan_missing' ? 'recipes' : item.source === 'low_stock_suggestion' ? 'suggestions' : 'manual';
}

export function shopCounts(items: readonly ShopItem[]) {
  const open = items.filter(i => i.selection === 'selected' && !i.purchasedAt);
  return {
    selected: open.length,
    toBuy: open.filter(i => !i.checked).length,
    checked: open.filter(i => i.checked).length,
    suggested: items.filter(i => i.selection === 'suggested' && !i.purchasedAt).length,
    purchased: items.filter(i => i.purchasedAt).length,
  };
}

const LOCATIONS: Record<string, string> = { fridge: 'la nevera', pantry: 'la despensa', freezer: 'el congelador' };

/** Human explanation derived only from recorded provenance. Never invents motive or amounts. */
export function shopReason(item: Pick<ShopItem, 'name' | 'source' | 'sources'>): string {
  const recipes = item.sources.filter(s => s.source === 'recipe_missing');
  const stock = item.sources.find(s => s.source === 'low_stock_suggestion');
  const plans = item.sources.filter(s => s.source === 'plan_missing');
  const parts: string[] = [];
  if (recipes.length) {
    const labels = [...new Set(recipes.map(s => s.label).filter((l): l is string => !!l))];
    if (labels.length === 0) parts.push('Falta para una receta que ya no está disponible');
    else parts.push(`Falta para ${labels[0]}${labels.length > 1 ? ` (+${labels.length - 1} más)` : ''}`);
  }
  if (plans.length) {
    const titles = [...new Set(plans.flatMap(p => {
      const entries = Array.isArray(p.ref.entries) ? p.ref.entries as { title?: unknown }[] : [];
      const names = entries.map(e => e.title).filter((t): t is string => typeof t === 'string');
      return names.length ? names : p.label ? [p.label] : [];
    }))];
    parts.push(titles.length === 0 ? 'Falta para tu plan' : `Falta para tu plan: ${titles[0]}${titles.length > 1 ? ` (+${titles.length - 1} más)` : ''}`);
  }
  if (stock) {
    const where = typeof stock.ref.location === 'string' ? LOCATIONS[stock.ref.location] : undefined;
    parts.push(`Te queda poco ${(stock.label ?? item.name).toLocaleLowerCase('es')}${where ? ` en ${where}` : ''}`);
  }
  if (parts.length === 0) {
    if (item.source === 'manual' || item.sources.some(s => s.source === 'manual')) return 'Lo añadiste tú';
    return 'Añadido antes de la nueva lista';
  }
  return parts.join(' · ');
}

export type ShopMutationOp = 'add_manual' | 'check' | 'uncheck' | 'select' | 'dismiss' | 'remove' | 'restore' | 'mark_purchased';
export interface ShopIntent {
  clientMutationId: string;
  op: ShopMutationOp;
  itemId?: string;
  expectedVersion?: number;
  name?: string;
  quantity?: number | null;
  unit?: string | null;
}

/** Optimistic view of a queued intent. The server result always replaces it; it is never reported as applied. */
export function applyIntentLocally(items: readonly ShopItem[], intent: ShopIntent, now: string): ShopItem[] {
  if (intent.op === 'add_manual') {
    if (items.some(i => i.id === intent.itemId)) return [...items];
    return [...items, { id: intent.itemId ?? intent.clientMutationId, name: (intent.name ?? '').trim(), quantity: intent.quantity ?? null, unit: intent.unit ?? null,
      conceptId: null, checked: false, selection: 'selected', source: 'manual', purchasedAt: null, version: 0, createdAt: now,
      sources: [{ source: 'manual', ref: {}, label: null, quantity: intent.quantity ?? null, unit: intent.unit ?? null }], pending: true }];
  }
  return items.flatMap((item): ShopItem[] => {
    if (item.id !== intent.itemId) return [item];
    switch (intent.op) {
      case 'check': return [{ ...item, checked: true, pending: true }];
      case 'uncheck': return [{ ...item, checked: false, pending: true }];
      case 'select': return [{ ...item, selection: 'selected', pending: true }];
      case 'dismiss': return [{ ...item, selection: 'dismissed', pending: true }];
      case 'mark_purchased': return [{ ...item, purchasedAt: now, pending: true }];
      case 'remove': return item.source === 'low_stock_suggestion' ? [{ ...item, selection: 'dismissed', pending: true }] : [];
      default: return [item];
    }
  });
}
