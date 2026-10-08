import { confirmation, sameOrigin } from '@/lib/cooking/v3-contracts';
import { cookingRoute, cookingRpc, CookingFault } from '@/lib/cooking/v3-server';
export const runtime = 'nodejs';
export function POST(request: Request) { return cookingRoute(async db => {
  if (!sameOrigin(request)) throw new CookingFault('INVALID_REQUEST');
  let body: unknown; try { body = await request.json(); } catch { throw new CookingFault('INVALID_REQUEST'); }
  if (!confirmation(body)) throw new CookingFault('INVALID_REQUEST');
  return cookingRpc(db, 'confirm_cooking_v3', { p_plan: body.planKey, p_mutation: body.clientMutationId, p_ack: body.acknowledgeReview, p_choices: body.choices });
}); }
