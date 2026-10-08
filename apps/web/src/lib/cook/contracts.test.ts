import { describe, expect, it } from 'vitest';
import { mutationBody, recipeRef, sameOrigin } from './contracts';
const id = 'c1000000-0000-4000-a000-000000000001';
describe('cook mutation trust boundary', () => {
  it('accepts only identity and a server token, never quantities or ownership', () => {
    const body = { recipeRef: { kind: 'import', id }, snapshotKey: id, clientMutationId: id };
    expect(mutationBody(body, 'shopping')).toBe(true);
    for (const extra of [{ userId: id }, { quantity: 1 }, { inventory: [] }, { plan: [] }]) expect(mutationBody({ ...body, ...extra }, 'shopping')).toBe(false);
    expect(recipeRef({ kind: 'catalog', id, userId: id })).toBe(false);
    expect(mutationBody({ recipeRef: body.recipeRef, recipeVersion: 'a'.repeat(64), clientMutationId: id }, 'save')).toBe(true);
  });
  it('rejects cross origin and missing Origin for writes', () => {
    expect(sameOrigin(new Request('https://neverita.test/api/cook/save', { headers: { Origin: 'https://other.test' } }))).toBe(false);
    expect(sameOrigin(new Request('https://neverita.test/api/cook/save'))).toBe(false);
    expect(sameOrigin(new Request('https://neverita.test/api/cook/save', { headers: { Origin: 'https://neverita.test' } }))).toBe(true);
  });
});
