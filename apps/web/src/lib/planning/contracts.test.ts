import { describe, expect, it } from 'vitest';
import { planStatus, shopBody, weekParams } from './contracts';

const id = 'a6000000-0000-4000-a000-000000000001';
const key = 'a'.repeat(64);

describe('plan request boundary', () => {
  it('accepts only a Monday from and a civil today', () => {
    expect(weekParams(new URLSearchParams('from=2026-10-19&today=2026-10-21'))).toEqual({ from: '2026-10-19', today: '2026-10-21' });
    expect(weekParams(new URLSearchParams('from=2026-10-20&today=2026-10-21'))).toBeNull();
    expect(weekParams(new URLSearchParams('from=2026-10-19&today=2026-02-30'))).toBeNull();
    expect(weekParams(new URLSearchParams('from=2026-10-19&today=2026-10-21&x=1'))).toBeNull();
    expect(weekParams(new URLSearchParams('from=2026-10-19'))).toBeNull();
  });
  it('keeps the shop body closed and the key a sha256', () => {
    const base = { from: '2026-10-19', today: '2026-10-21', clientMutationId: id, confirmedKey: key };
    expect(shopBody(base)).toBe(true);
    expect(shopBody({ ...base, userId: id })).toBe(false);
    expect(shopBody({ ...base, confirmedKey: 'nope' })).toBe(false);
    expect(shopBody({ ...base, from: '2026-10-20' })).toBe(false);
    expect(shopBody({ ...base, clientMutationId: 'x' })).toBe(false);
  });
  it('maps documented error statuses', () => {
    expect(planStatus('AUTH_REQUIRED')).toBe(401);
    expect(planStatus('INVALID_REQUEST')).toBe(400);
    expect(planStatus('PLAN_CHANGED')).toBe(409);
    expect(planStatus('MUTATION_CONFLICT')).toBe(409);
    expect(planStatus('PLAN_UNAVAILABLE')).toBe(503);
  });
});
