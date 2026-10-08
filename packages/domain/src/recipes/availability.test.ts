import { describe, expect, it } from 'vitest';
import { recipeAvailability, safeOriginalUrl, type CookRecipe } from './availability';
import type { TodayPantryItem } from '../recommendations/today';
const concepts = ['Tortillas', 'Queso', 'Tomate', 'Jamón'].map((displayName, i) => ({ id: String(i), displayName }));
const recipe: CookRecipe = { recipeRef: { kind: 'import', id: 'recipe' }, title: 'Rolls', ingredients: concepts.map(c => ({ name: c.displayName })), steps: ['Enrollar'], sourceUrl: null, reviewRequired: true, provenance: {} };
const stock = (id: string): TodayPantryItem => ({ id, displayName: concepts[Number(id)].displayName, foodConceptId: id, commercialProductId: null, normalizationStatus: 'confirmed', stock: { mode: 'presence', quantityPrecision: 'unknown', state: 'present' }, freshness: { precision: 'unknown' } });
describe('private recipe availability', () => {
  it('counts 2 of 4 without inventing quantities or sufficiency', () => {
    const r = recipeAvailability(recipe, [stock('0'), stock('1')], concepts, '2026-10-08');
    expect([r.haveCount, r.totalCount, r.missingCount]).toEqual([2, 4, 2]);
    expect(r.quantityToCheck).toBe(true); expect(r.ingredients.every(i => i.amount_status === 'unknown' && i.amount_value === null)).toBe(true);
    expect(r.ingredients.map(i => i.decision)).toEqual(['have_presence_unknown_amount', 'have_presence_unknown_amount', 'missing', 'missing']);
  });
  it('groups repeated concepts and reports a deficit across the whole group', () => {
    const r = recipeAvailability({ ...recipe, ingredients: [{ name: 'Queso', measure: '100 g' }, { name: 'Queso', measure: '0.2 kg' }] }, [{ ...stock('1'), stock: { mode: 'exact', quantityPrecision: 'exact', quantity: 200, unit: 'g' } }], concepts, '2026-10-08');
    expect([r.haveCount, r.totalCount, r.missingCount]).toEqual([0, 1, 1]); expect(r.shopping[0].deficitQuantity).toBe(100); expect(r.ingredients.every(i => i.decision === 'missing')).toBe(true);
  });
  it('keeps an ambiguous name unknown and never adds it to shopping', () => {
    const r = recipeAvailability({ ...recipe, ingredients: [{ name: 'Queso' }] }, [], [...concepts, { id: 'x', displayName: 'Queso' }], '2026-10-08');
    expect([r.unknownCount, r.missingCount, r.haveCount]).toEqual([1, 0, 0]);
  });
  it('does not promote incompatible stock or absent legacy knowledge', () => {
    const r = recipeAvailability({ ...recipe, ingredients: [{ name: 'Queso', measure: '100 g' }] }, [{ ...stock('1'), stock: { mode: 'exact', quantityPrecision: 'exact', quantity: 2, unit: 'unit' } }], concepts, '2026-10-08');
    expect(r.ingredients[0].decision).toBe('unknown'); expect(r.shopping).toEqual([]);
    expect(recipeAvailability(recipe, [{ ...stock('0'), deletedAt: '2026-10-08' }, { ...stock('1'), normalizationStatus: 'unknown' }], concepts, '2026-10-08').haveCount).toBe(0);
  });
  it('rejects original URLs containing credentials and executable schemes', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/a', 'https://name:secret@example.com/recipe']) expect(safeOriginalUrl(url)).toBeNull();
    expect(safeOriginalUrl('https://example.com/recipe')).toBe('https://example.com/recipe');
  });
  it('preserves separate original amount/unit when only a unit was supplied', () => {
    const r = recipeAvailability({ ...recipe, ingredients: [{ name: 'Queso', measure: 'g', originalAmount: null, originalUnit: 'g' }] }, [stock('1')], concepts, '2026-10-08');
    expect(r.ingredients[0]).toMatchObject({ originalAmount: null, originalUnit: 'g', amount_status: 'unknown', amount_value: null, amount_unit: null });
  });
});
