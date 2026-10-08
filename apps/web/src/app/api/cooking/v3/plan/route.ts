import { sourceRef } from '@/lib/cooking/v3-contracts';
import { cookingPlan, cookingRoute, CookingFault } from '@/lib/cooking/v3-server';
export const runtime = 'nodejs';
export function GET(request: Request) { return cookingRoute(async (db, uid) => {
  const q = new URL(request.url).searchParams; const source = { kind: q.get('kind'), id: q.get('id') };
  if ([...q.keys()].length !== 2 || [...q.keys()].some(k => !['kind', 'id'].includes(k)) || !sourceRef(source)) throw new CookingFault('INVALID_REQUEST');
  return cookingPlan(db, uid, source);
}); }
// Exported only through GET; flag/auth/error handling is shared with mutations.
