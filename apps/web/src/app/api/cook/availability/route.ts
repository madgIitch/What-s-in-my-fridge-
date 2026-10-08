import { recipeRef } from '@/lib/cook/contracts';
import { availability, CookFault } from '@/lib/cook/server';
import { cookRoute } from '@/lib/cook/route';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return cookRoute(async (db, userId) => { const p = new URL(request.url).searchParams; const ref = { kind: p.get('kind'), id: p.get('id') }; if (!recipeRef(ref) || [...p.keys()].some(k => !['kind', 'id'].includes(k))) throw new CookFault('INVALID_REQUEST'); return availability(db, userId, ref); });
}
