import { sameOrigin, undoBody } from '@/lib/shop/contracts';
import { jsonBody, shopRoute, shopRpc, ShopFault } from '@/lib/shop/server';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return shopRoute(async db => {
    if (!sameOrigin(request)) throw new ShopFault('INVALID_REQUEST');
    const body = await jsonBody(request);
    if (!undoBody(body)) throw new ShopFault('INVALID_REQUEST');
    return shopRpc(db, 'undo_shopping_reconciliation_v1', { p_event: body.eventId, p_mutation: body.clientMutationId });
  });
}
