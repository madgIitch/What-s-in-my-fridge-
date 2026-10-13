import { reconcileBody, sameOrigin } from '@/lib/shop/contracts';
import { jsonBody, shopRoute, shopRpc, ShopFault } from '@/lib/shop/server';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return shopRoute(async db => {
    if (!sameOrigin(request)) throw new ShopFault('INVALID_REQUEST');
    const body = await jsonBody(request);
    if (!reconcileBody(body)) throw new ShopFault('INVALID_REQUEST');
    return shopRpc(db, 'reconcile_shopping_after_receipt_v1', {
      p_draft: body.draftId, p_mutation: body.clientMutationId, p_mode: body.mode, p_session: body.sessionId ?? null,
    });
  });
}
