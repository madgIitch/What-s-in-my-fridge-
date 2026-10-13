import { describe, expect, it } from 'vitest';
import { intentBody, reconcileBody, sessionBody, shopStatus, undoBody } from './contracts';

const id = 'f1000000-0000-4000-a000-000000000001';
const other = 'f1000000-0000-4000-a000-000000000002';

describe('shop mutation boundary', () => {
  it('accepts only closed, well-typed manual adds', () => {
    expect(intentBody({ clientMutationId: id, op: 'add_manual', name: 'Leche', quantity: 2, unit: 'l' })).toBe(true);
    expect(intentBody({ clientMutationId: id, op: 'add_manual', name: 'Leche', quantity: null, unit: null, itemId: other })).toBe(true);
    expect(intentBody({ clientMutationId: id, op: 'add_manual', name: '   ' })).toBe(false);
    expect(intentBody({ clientMutationId: id, op: 'add_manual', name: 'x'.repeat(121) })).toBe(false);
    expect(intentBody({ clientMutationId: id, op: 'add_manual', name: 'Leche', quantity: -1 })).toBe(false);
    expect(intentBody({ clientMutationId: id, op: 'add_manual', name: 'Leche', expectedVersion: 1 })).toBe(false);
  });
  it('rejects forged authority, unknown operations and stray fields', () => {
    expect(intentBody({ clientMutationId: id, op: 'check', itemId: other, userId: other })).toBe(false);
    expect(intentBody({ clientMutationId: id, op: 'check', itemId: other, source: 'manual' })).toBe(false);
    expect(intentBody({ clientMutationId: id, op: 'check', itemId: other, purchasedAt: '2026-10-13' })).toBe(false);
    expect(intentBody({ clientMutationId: id, op: 'delete_all', itemId: other })).toBe(false);
    expect(intentBody({ clientMutationId: 'nope', op: 'check', itemId: other })).toBe(false);
    expect(intentBody({ clientMutationId: id, op: 'check' })).toBe(false);
    expect(intentBody({ clientMutationId: id, op: 'check', itemId: other, name: 'Leche' })).toBe(false);
  });
  it('requires integer versions and a known item for item operations', () => {
    expect(intentBody({ clientMutationId: id, op: 'dismiss', itemId: other, expectedVersion: 3 })).toBe(true);
    expect(intentBody({ clientMutationId: id, op: 'dismiss', itemId: other, expectedVersion: 0 })).toBe(false);
    expect(intentBody({ clientMutationId: id, op: 'dismiss', itemId: other, expectedVersion: 1.5 })).toBe(false);
  });
  it('keeps session, reconcile and undo bodies closed', () => {
    expect(sessionBody({ clientMutationId: id })).toBe(true);
    expect(sessionBody({ clientMutationId: id, userId: other })).toBe(false);
    expect(reconcileBody({ draftId: id, clientMutationId: other, mode: 'apply' })).toBe(true);
    expect(reconcileBody({ draftId: id, clientMutationId: other, mode: 'skip', sessionId: id })).toBe(true);
    expect(reconcileBody({ draftId: id, clientMutationId: other, mode: 'force' })).toBe(false);
    expect(reconcileBody({ draftId: id, clientMutationId: other, mode: 'apply', items: [] })).toBe(false);
    expect(undoBody({ eventId: id, clientMutationId: other })).toBe(true);
    expect(undoBody({ eventId: id })).toBe(false);
  });
  it('maps error codes to the documented statuses', () => {
    expect(shopStatus('AUTH_REQUIRED')).toBe(401);
    expect(shopStatus('INVALID_REQUEST')).toBe(400);
    expect(shopStatus('ITEM_NOT_FOUND')).toBe(404);
    expect(shopStatus('VERSION_CONFLICT')).toBe(409);
    expect(shopStatus('MUTATION_CONFLICT')).toBe(409);
    expect(shopStatus('UNDO_CONFLICT')).toBe(409);
    expect(shopStatus('SHOP_UNAVAILABLE')).toBe(503);
  });
});
