import { weekParams } from '@/lib/planning/contracts';
import { planRoute, planRpc, PlanFault } from '@/lib/planning/server';
export const runtime = 'nodejs';
export function GET(request: Request) {
  return planRoute(async db => {
    const params = weekParams(new URL(request.url).searchParams);
    if (!params) throw new PlanFault('INVALID_REQUEST');
    return planRpc(db, 'plan_week_v1', { p_from: params.from, p_today: params.today });
  });
}
