import { productV3Enabled } from '@/app/(auth)/app/product-v3';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { CookFault, type CookDb } from './server';
import { cookError, privateHeaders } from './contracts';
export async function cookRoute(action: (db: CookDb, userId: string) => Promise<unknown>) {
  if (!productV3Enabled()) return new Response(null, { status: 404, headers: privateHeaders });
  try {
    const s = await createServerSupabaseClient(); const { data: { user } } = await s.auth.getUser();
    if (!user) return cookError('AUTH_REQUIRED', 401);
    const result = await action(s as unknown as CookDb, user.id);
    const { data: { user: current } } = await s.auth.getUser();
    if (!current || current.id !== user.id) return cookError('AUTH_REQUIRED', 401);
    return Response.json(result, { headers: privateHeaders });
  } catch (error) {
    const code = error instanceof CookFault ? error.code : 'COOK_UNAVAILABLE';
    const status = code === 'AUTH_REQUIRED' ? 401 : code === 'RECIPE_NOT_FOUND' ? 404 : code === 'RECIPE_INVALID' ? 422 : ['INVALID_REQUEST', 'CURSOR_INVALID'].includes(code) ? 400 : code.endsWith('CONFLICT') ? 409 : 503;
    return cookError(code, status);
  }
}
