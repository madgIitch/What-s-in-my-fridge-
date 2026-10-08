import { cookRoute } from '@/lib/cook/route';
import { CookFault, library } from '@/lib/cook/server';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return cookRoute(async (db, userId) => { const p = new URL(request.url).searchParams; const view = p.get('view') ?? 'today'; const limit = Number(p.get('limit') ?? 20); const cursor = p.get('cursor'); if (!['today', 'saved', 'imported'].includes(view) || !Number.isInteger(limit) || limit < 1 || limit > 50 || (cursor && cursor.length > 300) || [...p.keys()].some(k => !['view', 'limit', 'cursor'].includes(k))) throw new CookFault('INVALID_REQUEST'); return library(db, userId, view, limit, cursor); });
}
