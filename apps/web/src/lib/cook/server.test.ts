import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabaseClient: () => ({ rpc: vi.fn() }) }));
import { library, type CookDb } from './server';
const ids = [1, 2, 3].map(n => `d1000000-0000-4000-a000-00000000000${n}`);
const context = { date: '2026-10-08', pantry: [], concepts: [], catalog: [], catalogMissing: true, saved: [], jobs: ids.map((id, n) => ({ id, state: 'failed', sourceType: 'manual', errorCode: 'WHISPER_REJECTED', retryable: false, createdAt: String(3 - n), recipe: null })) };
const db: CookDb = { rpc: async () => ({ data: context, error: null }) };
describe('library cursor', () => {
  it('pages a stable view and rejects a cursor from another account or view', async () => {
    const a = await library(db, 'owner', 'imported', 2, null); expect(a.items).toHaveLength(2); expect(a.nextCursor).toBeTruthy();
    const b = await library(db, 'owner', 'imported', 2, a.nextCursor); expect(b.items.map(i => i.recipeRef.id)).toEqual([ids[2]]); expect(b.nextCursor).toBeNull();
    await expect(library(db, 'other', 'imported', 2, a.nextCursor)).rejects.toThrow('CURSOR_INVALID');
    await expect(library(db, 'owner', 'saved', 2, a.nextCursor)).rejects.toThrow('CURSOR_INVALID');
  });
  it('rejects modified inputs, malformed cursor and negative offset', async () => {
    const a = await library(db, 'owner', 'imported', 1, null);
    const changed: CookDb = { rpc: async () => ({ data: { ...context, pantry: [{ id: 'new' }] }, error: null }) };
    await expect(library(changed, 'owner', 'imported', 1, a.nextCursor)).rejects.toThrow('CURSOR_INVALID');
    await expect(library(db, 'owner', 'imported', 1, 'invalid')).rejects.toThrow('CURSOR_INVALID');
  });
});
