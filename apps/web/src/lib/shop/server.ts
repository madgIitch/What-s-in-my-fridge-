import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { productV3Enabled } from '@/app/(auth)/app/product-v3';
import { privateHeaders, shopError } from './contracts';

type Db = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export class ShopFault extends Error { constructor(public code: string) { super(code); } }

export async function shopRpc(db: Db, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, args);
  if (error || !data) throw new ShopFault('SHOP_UNAVAILABLE');
  if (typeof data === 'object' && 'error' in data) throw new ShopFault(String((data as { error: unknown }).error));
  return data;
}

/** Flag off: 404 and no work. Authenticated, private, and re-checked so a swapped session never leaks a result. */
export async function shopRoute(work: (db: Db) => Promise<unknown>) {
  if (!productV3Enabled()) return new Response(null, { status: 404 });
  try {
    const s = await createServerSupabaseClient(); const { data: { user } } = await s.auth.getUser();
    if (!user) return shopError('AUTH_REQUIRED');
    const result = await work(s as unknown as Db);
    const { data: { user: current } } = await s.auth.getUser(); if (!current || current.id !== user.id) return shopError('AUTH_REQUIRED');
    return Response.json(result, { headers: privateHeaders });
  } catch (e) { return shopError(e instanceof ShopFault ? e.code : 'SHOP_UNAVAILABLE'); }
}

export async function jsonBody(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new ShopFault('INVALID_REQUEST'); }
}
