import { intentBody, sameOrigin } from '@/lib/shop/contracts';
import { jsonBody, shopRoute, shopRpc, ShopFault } from '@/lib/shop/server';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return shopRoute(async db => {
    if (!sameOrigin(request)) throw new ShopFault('INVALID_REQUEST');
    const body = await jsonBody(request);
    if (!intentBody(body)) throw new ShopFault('INVALID_REQUEST');
    return shopRpc(db, 'apply_shop_mutation_v1', {
      p_mutation: body.clientMutationId, p_op: body.op, p_item: body.itemId ?? null, p_expected: body.expectedVersion ?? null,
      p_name: body.name ?? null, p_quantity: body.quantity ?? null, p_unit: body.unit ?? null,
    });
  });
}
