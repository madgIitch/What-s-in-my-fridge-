import { mutationBody, sameOrigin } from '@/lib/cook/contracts';
import { cookRoute } from '@/lib/cook/route';
import { CookFault, rpc } from '@/lib/cook/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return cookRoute(async db => { if (!sameOrigin(request)) throw new CookFault('INVALID_REQUEST'); let body: unknown; try { body = await request.json(); } catch { throw new CookFault('INVALID_REQUEST'); } if (!mutationBody(body, 'shopping')) throw new CookFault('INVALID_REQUEST'); return rpc(db, 'apply_cook_mutation_v1', { p_operation: 'shopping', p_kind: body.recipeRef.kind, p_id: body.recipeRef.id, p_token: body.snapshotKey, p_mutation: body.clientMutationId }); });
}
