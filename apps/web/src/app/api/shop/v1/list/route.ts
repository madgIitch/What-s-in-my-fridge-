import { shopRoute, shopRpc, ShopFault } from '@/lib/shop/server';
import { uuid } from '@/lib/shop/contracts';
export const runtime = 'nodejs';
export function GET(request: Request) {
  return shopRoute(async db => {
    const params = new URL(request.url).searchParams;
    for (const [key, value] of params) if (key !== 'shoppingSession' || !uuid(value)) throw new ShopFault('INVALID_REQUEST');
    return shopRpc(db, 'shop_list_v1', {});
  });
}
