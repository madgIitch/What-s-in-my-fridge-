import { sameOrigin, shopBody } from '@/lib/planning/contracts';
import { planJson, planRoute, planRpc, PlanFault } from '@/lib/planning/server';
export const runtime = 'nodejs';
export function POST(request: Request) {
  return planRoute(async db => {
    if (!sameOrigin(request)) throw new PlanFault('INVALID_REQUEST');
    const body = await planJson(request);
    if (!shopBody(body)) throw new PlanFault('INVALID_REQUEST');
    return planRpc(db, 'plan_add_to_shop_v1', { p_from: body.from, p_today: body.today, p_mutation: body.clientMutationId, p_key: body.confirmedKey });
  });
}
