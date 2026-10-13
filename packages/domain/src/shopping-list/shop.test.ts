import { describe, expect, it } from 'vitest';
import { applyIntentLocally, canMerge, canonicalUnit, mergeKey, sectionOf, shopCounts, shopReason, type ShopItem } from './shop';

const item = (patch: Partial<ShopItem> = {}): ShopItem => ({
  id: 'i1', name: 'Huevos', quantity: 2, unit: 'unidades', conceptId: 'c1', checked: false, selection: 'selected', source: 'manual',
  purchasedAt: null, version: 1, sources: [], ...patch,
});

describe('R5 shopping rules', () => {
  it('canonicalizes only inside the weight, volume, unit and pack families', () => {
    expect(canonicalUnit('Kg')).toEqual({ base: 'g', factor: 1000 });
    expect(canonicalUnit('litros')).toEqual({ base: 'ml', factor: 1000 });
    expect(canonicalUnit('uds').base).toBe('unit');
    expect(canonicalUnit(null).base).toBeNull();
    expect(canonicalUnit('g').base).not.toBe(canonicalUnit('unidades').base);
  });
  it('merges compatible units but never 2 units with 500 g or exact with unknown quantity', () => {
    expect(canMerge(item({ quantity: 500, unit: 'g' }), item({ id: 'i2', quantity: 1, unit: 'kg' }))).toBe(true);
    expect(canMerge(item({ quantity: 2, unit: 'unidades' }), item({ id: 'i2', quantity: 500, unit: 'g' }))).toBe(false);
    expect(canMerge(item({ quantity: 2, unit: 'pack' }), item({ id: 'i2', quantity: 2, unit: 'unit' }))).toBe(false);
    expect(canMerge(item({ quantity: null, unit: null }), item({ id: 'i2', quantity: 3, unit: null }))).toBe(false);
    expect(canMerge(item({ quantity: null, unit: null }), item({ id: 'i2', quantity: null, unit: null }))).toBe(true);
  });
  it('merges unresolved items only by identical normalized name, never suggestions or purchased items', () => {
    expect(canMerge(item({ conceptId: null, name: 'Pan  Integral' }), item({ id: 'i2', conceptId: null, name: 'pan integral' }))).toBe(true);
    expect(canMerge(item({ conceptId: null, name: 'Pan' }), item({ id: 'i2', conceptId: null, name: 'Pan integral' }))).toBe(false);
    expect(mergeKey(item({ selection: 'suggested', source: 'low_stock_suggestion' }))).toBeNull();
    expect(mergeKey(item({ purchasedAt: '2026-10-13T10:00:00Z' }))).toBeNull();
  });
  it('keeps suggestions out of the selected counters', () => {
    const counts = shopCounts([item(), item({ id: 'i2', checked: true }), item({ id: 's', selection: 'suggested', source: 'low_stock_suggestion' }),
      item({ id: 'p', purchasedAt: '2026-10-13T10:00:00Z' })]);
    expect(counts).toMatchObject({ selected: 2, toBuy: 1, checked: 1, suggested: 1, purchased: 1 });
  });
  it('explains every item from recorded provenance only', () => {
    const recipe = (label: string | null) => ({ source: 'recipe_missing' as const, ref: {}, label, quantity: null, unit: null });
    expect(shopReason(item({ source: 'recipe_missing', sources: [recipe('Tortilla')] }))).toBe('Falta para Tortilla');
    expect(shopReason(item({ source: 'recipe_missing', sources: [recipe('Tortilla'), recipe('Pisto')] }))).toBe('Falta para Tortilla (+1 más)');
    expect(shopReason(item({ source: 'recipe_missing', sources: [recipe(null)] }))).toBe('Falta para una receta que ya no está disponible');
    expect(shopReason(item({ source: 'low_stock_suggestion', sources: [{ source: 'low_stock_suggestion', ref: { location: 'fridge' }, label: 'Leche', quantity: null, unit: null }] })))
      .toBe('Te queda poco leche en la nevera');
    expect(shopReason(item({ source: 'manual' }))).toBe('Lo añadiste tú');
    expect(shopReason(item({ source: 'legacy' }))).toBe('Añadido antes de la nueva lista');
  });
  it('places items in their section', () => {
    expect(sectionOf({ source: 'recipe_missing' })).toBe('recipes');
    expect(sectionOf({ source: 'low_stock_suggestion' })).toBe('suggestions');
    expect(sectionOf({ source: 'legacy' })).toBe('manual');
  });
  it('shows queued intents as pending without touching pantry-shaped data', () => {
    const base = [item()];
    expect(applyIntentLocally(base, { clientMutationId: 'm', op: 'check', itemId: 'i1' }, 'now')[0]).toMatchObject({ checked: true, pending: true });
    expect(applyIntentLocally(base, { clientMutationId: 'm', op: 'remove', itemId: 'i1' }, 'now')).toHaveLength(0);
    const added = applyIntentLocally(base, { clientMutationId: 'm2', op: 'add_manual', itemId: 'n1', name: ' Pan ', quantity: null, unit: null }, 'now');
    expect(added[1]).toMatchObject({ id: 'n1', name: 'Pan', pending: true, selection: 'selected' });
    expect(applyIntentLocally(added, { clientMutationId: 'm2', op: 'add_manual', itemId: 'n1', name: 'Pan' }, 'now')).toHaveLength(2);
  });
});
