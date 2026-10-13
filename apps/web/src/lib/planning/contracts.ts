import { uuid } from '@/lib/cook/contracts';
export { sameOrigin, uuid } from '@/lib/cook/contracts';
import { isCivilDate, isoWeekday } from '../../../../../packages/domain/src/planning/week';

export type PlanMissingLine = {
  conceptId: string; name: string; quantity: number | null; unit: string | null;
  entries: { mealEntryId: string; title: string; date: string; recipeKind: string | null; recipeId: string | null; source: string | null }[];
};
export type PlanMissing = {
  count: number; lines: PlanMissingLine[]; key: string; computedAt: string;
  unresolved: { name: string; mealEntryId: string; title: string; date: string }[];
  unavailable: { mealEntryId: string; title: string; date: string }[];
};
export type PlanWeekEntry = {
  id: string; version: number; mealType: string; kind: 'recipe' | 'outside' | 'legacy'; state: 'planned' | 'registered';
  title: string | null; recipeRef: { kind: 'catalog' | 'import'; id: string } | null; readOnly: boolean;
};
export type PlanWeek = { contract: 'plan-week-v1'; from: string; days: { date: string; entries: PlanWeekEntry[] }[]; missing: PlanMissing };

export const privateHeaders = { 'Cache-Control': 'private, no-store' };
const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'La sesión ha caducado. Inicia sesión.',
  INVALID_REQUEST: 'Revisa la semana e inténtalo de nuevo.',
  PLAN_CHANGED: 'Tu plan ha cambiado. Revisa lo que falta antes de añadirlo.',
  VERSION_CONFLICT: 'Tu plan ha cambiado en otro dispositivo.',
  MUTATION_CONFLICT: 'Ese cambio ya se usó con otros datos. Inténtalo de nuevo.',
  PLAN_UNAVAILABLE: 'El plan no está disponible ahora. Reintenta en un momento.',
};
export function planStatus(code: string) {
  return code === 'AUTH_REQUIRED' ? 401 : code === 'INVALID_REQUEST' ? 400 : code === 'PLAN_CHANGED' || code === 'VERSION_CONFLICT' || code === 'MUTATION_CONFLICT' ? 409 : 503;
}
export function planError(code: string) {
  const known = code in MESSAGES ? code : 'PLAN_UNAVAILABLE'; const status = planStatus(known);
  return Response.json({ contract: 'plan-error-v1', error: { code: known, message: MESSAGES[known], retryable: status === 503 } }, { status, headers: privateHeaders });
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** from must be a Monday civil date; today is the device civil date. */
export function weekParams(params: URLSearchParams): { from: string; today: string } | null {
  const keys = [...params.keys()];
  const from = params.get('from') ?? ''; const today = params.get('today') ?? '';
  if (keys.length !== 2 || !keys.includes('from') || !keys.includes('today')) return null;
  if (!isCivilDate(from) || !isCivilDate(today) || isoWeekday(from) !== 1) return null;
  return { from, today };
}
export function shopBody(v: unknown): v is { from: string; today: string; clientMutationId: string; confirmedKey: string } {
  return object(v) && Object.keys(v).length === 4 && ['from', 'today', 'clientMutationId', 'confirmedKey'].every(k => k in v)
    && typeof v.from === 'string' && isCivilDate(v.from) && isoWeekday(v.from) === 1 && typeof v.today === 'string' && isCivilDate(v.today)
    && uuid(v.clientMutationId) && typeof v.confirmedKey === 'string' && /^[0-9a-f]{64}$/.test(v.confirmedKey);
}
