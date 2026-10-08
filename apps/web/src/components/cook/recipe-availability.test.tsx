import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, callback: null as null | ((event: string, session: { user: { id: string } } | null) => void) }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabaseClient: () => ({ auth: { getUser: async () => ({ data: { user: auth.user } }), onAuthStateChange: (cb: typeof auth.callback) => { auth.callback = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; } } }) }));
import { RecipeAvailability } from './recipe-availability';
const id = 'd1000000-0000-4000-a000-000000000001';
const result = { contract: 'recipe-availability-v1', recipeRef: { kind: 'import', id }, recipeVersion: 'a'.repeat(64), snapshotKey: id, computedAt: '2026-10-08T12:00:00Z', expiresAt: '2026-10-08T13:00:00Z', title: 'Private meal', steps: [], sourceUrl: null, reviewRequired: true, haveCount: 2, totalCount: 4, missingCount: 2, unknownCount: 0, quantityToCheck: true, availability: 'missing_many', ingredients: [{ position: 0, name: 'Tomate privado', groupKey: 'tomato', decision: 'missing', amount_status: 'unknown', originalAmount: null }] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); auth.user = { id: 'owner' }; auth.callback = null; });
describe('import availability interactions', () => {
  it('requires acknowledgement and preserves mutation id after network failure', async () => {
    const bodies: string[] = []; const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/shopping')) { bodies.push(String(init?.body)); if (bodies.length === 1) throw new Error('network'); return Response.json({ status: 'applied', result: { itemIds: [id] } }); }
      return Response.json(result);
    }); vi.stubGlobal('fetch', fetcher);
    render(<RecipeAvailability userId='owner' recipeRef={{ kind: 'import', id }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Añadir 2 a la compra' }));
    expect(screen.getByRole('button', { name: 'Confirmar y añadir' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Confirmar y añadir' }));
    await screen.findByText('No se ha confirmado. Reintenta con el mismo intento.');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y añadir' })); await screen.findByRole('heading', { name: 'Añadido a la compra' });
    expect(bodies).toHaveLength(2); expect(bodies[0]).toBe(bodies[1]);
    expect(Object.keys(JSON.parse(bodies[0]))).toEqual(['recipeRef', 'snapshotKey', 'clientMutationId']);
  });
  it('does not restore private data after a pending request resolves after logout', async () => {
    let resolve: (value: Response) => void = () => {}; const pending = new Promise<Response>(r => { resolve = r; }); vi.stubGlobal('fetch', vi.fn(() => pending));
    render(<RecipeAvailability userId='owner' recipeRef={{ kind: 'import', id }} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    act(() => { auth.user = null; auth.callback?.('SIGNED_OUT', null); });
    await act(async () => { resolve(Response.json(result)); await Promise.resolve(); });
    expect(screen.queryByText('Tomate privado')).not.toBeInTheDocument(); expect(screen.getByText('La sesión ha caducado.')).toBeInTheDocument();
  });
});
