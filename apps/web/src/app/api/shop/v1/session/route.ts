import { sameOrigin, sessionBody } from '@/lib/shop/contracts';
import { jsonBody, shopRoute, shopRpc, ShopFault } from '@/lib/shop/server';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return shopRoute(async db => {
    if (!sameOrigin(request)) throw new ShopFault('INVALID_REQUEST');
    const body = await jsonBody(request);
    if (!sessionBody(body)) throw new ShopFault('INVALID_REQUEST');
    return shopRpc(db, 'start_shopping_session_v1', { p_mutation: body.clientMutationId });
  });
}
