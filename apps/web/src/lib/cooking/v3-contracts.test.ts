import { describe, expect, it } from 'vitest';
import { confirmation, undoBody, choice, sourceRef } from './v3-contracts';
const id = 'e1000000-0000-4000-a000-000000000001';
describe('cooking mutation boundary', () => {
  it('rejects forged authority, duplicated lines and invalid quantities', () => { const b = { planKey: id, clientMutationId: id, acknowledgeReview: false, choices: [{ lineId: 'egg', action: 'apply' }] }; expect(confirmation(b)).toBe(true); expect(confirmation({ ...b, userId: id })).toBe(false); expect(confirmation({ ...b, choices: [...b.choices, ...b.choices] })).toBe(false); expect(choice({ lineId: 'egg', action: 'set_consumption', quantity: NaN, unit: 'unit' })).toBe(false); expect(choice({ lineId: 'egg', action: 'keep', after: 0 })).toBe(false); });
  it('uses explicit lot for qualitative updates and private source refs', () => { expect(choice({ lineId: 'egg', action: 'set_state', state: 'low' })).toBe(false); expect(choice({ lineId: 'egg', action: 'set_state', state: 'low', inventoryItemId: id })).toBe(true); expect(sourceRef({ kind: 'favorite', id })).toBe(true); expect(undoBody({ eventId: id, clientMutationId: id })).toBe(true); expect(undoBody({ eventId: id, clientMutationId: id, versions: [] })).toBe(false); });
});
