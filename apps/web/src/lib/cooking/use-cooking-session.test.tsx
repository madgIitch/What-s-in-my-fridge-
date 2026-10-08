import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, callbacks: [] as ((event: string, session: null) => void)[], stored: null as unknown, save: vi.fn(), purge: vi.fn() }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: mock.user } }), getSession: async () => ({ data: { session: { user: mock.user } } }), onAuthStateChange: (cb: (event: string, session: null) => void) => { mock.callbacks.push(cb); return { data: { subscription: { unsubscribe: vi.fn() } } }; } } }) }));
vi.mock('./v3-storage', () => ({ latestDraft: async () => mock.stored, saveDraft: (d: unknown) => mock.save(d), purgeCookingUser: (u: string) => mock.purge(u), watchCookingPrivacy: vi.fn() }));
import { useCookingSession } from './use-cooking-session';
const source = { kind: 'import' as const, id: 'e1000000-0000-4000-a000-000000000001' };
const plan = { contract: 'cooking-plan-v1', sourceRef: source, planKey: source.id, recipeVersion: 'v1', computedAt: '2026-10-08T12:00:00Z', expiresAt: '2026-10-08T13:00:00Z', recipe: { title: 'Private recipe', ingredients: [], steps: ['Cook'], reviewRequired: false }, lines: [] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); mock.user = { id: 'owner' }; mock.callbacks = []; mock.stored = null; mock.save.mockReset(); mock.purge.mockReset(); });
describe('cooking session safety', () => {
  it('ignores a private response resolving after logout and purges drafts', async () => {
    mock.purge.mockResolvedValue(undefined);
    let finish: (r: Response) => void = () => {}; vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    const hook = renderHook(() => useCookingSession('owner', source)); await waitFor(() => expect(fetch).toHaveBeenCalled());
    act(() => { mock.user = null; mock.callbacks.forEach(cb => cb('SIGNED_OUT', null)); });
    await act(async () => { finish(Response.json(plan)); }); expect(hook.result.current.draft).toBeNull(); expect(hook.result.current.status).toBe('expired'); expect(mock.purge).toHaveBeenCalledWith('owner'); expect(mock.save).not.toHaveBeenCalled();
  });
  it('keeps an offline intention pending without pretending inventory was applied', async () => {
    const fetcher = vi.fn(async () => Response.json(plan)); vi.stubGlobal('fetch', fetcher); const hook = renderHook(() => useCookingSession('owner', source)); await waitFor(() => expect(hook.result.current.draft).not.toBeNull());
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await act(async () => { await hook.result.current.confirm(); });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(hook.result.current.draft?.state).toBe('pending'); expect(hook.result.current.draft?.result).toBeNull(); expect(hook.result.current.draft?.intent?.planKey).toBe(source.id);
  });
  it('requires fresh consent after server conflict and remains usable when storage fails', async () => {
    mock.save.mockRejectedValue(new Error('storage disabled')); vi.stubGlobal('fetch', vi.fn(async (_: string, init?: RequestInit) => init?.method === 'POST' ? Response.json({ error: { code: 'PLAN_EXPIRED', message: 'Expired' } }, { status: 409 }) : Response.json(plan)));
    const hook = renderHook(() => useCookingSession('owner', source)); await waitFor(() => expect(hook.result.current.draft).not.toBeNull()); await act(async () => { await hook.result.current.confirm(); });
    expect(hook.result.current.storageWarning).toBe(true); expect(hook.result.current.draft?.state).toBe('needs_review'); const calls = vi.mocked(fetch).mock.calls.length; await act(async () => { await hook.result.current.confirm(); }); expect(fetch).toHaveBeenCalledTimes(calls);
  });
});
