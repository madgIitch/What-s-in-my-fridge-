import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { productV3Enabled } from '@/app/(auth)/app/product-v3';
import { planError, privateHeaders } from './contracts';

type Db = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };
export class PlanFault extends Error { constructor(public code: string) { super(code); } }

export async function planRpc(db: Db, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, args);
  if (error || !data) throw new PlanFault('PLAN_UNAVAILABLE');
  if (typeof data === 'object' && 'error' in data) throw new PlanFault(String((data as { error: unknown }).error));
  return data;
}

/** Flag off: 404 and no work. Authenticated, private and re-checked so a swapped session never leaks a result. */
export async function planRoute(work: (db: Db) => Promise<unknown>) {
  if (!productV3Enabled()) return new Response(null, { status: 404 });
  try {
    const s = await createServerSupabaseClient(); const { data: { user } } = await s.auth.getUser();
    if (!user) return planError('AUTH_REQUIRED');
    const result = await work(s as unknown as Db);
    const { data: { user: current } } = await s.auth.getUser(); if (!current || current.id !== user.id) return planError('AUTH_REQUIRED');
    return Response.json(result, { headers: privateHeaders });
  } catch (e) { return planError(e instanceof PlanFault ? e.code : 'PLAN_UNAVAILABLE'); }
}
export async function planJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { throw new PlanFault('INVALID_REQUEST'); }
}
