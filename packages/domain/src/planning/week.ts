/** R6 weekly planning rules. Dates are civil (YYYY-MM-DD); arithmetic never goes through local milliseconds. */
export const PLAN_LIMITS = { perDay: 3, perWeek: 60, weeksBack: 8, weeksAhead: 12 } as const;
export const OUTSIDE_TITLE = 'Cenar fuera';
export const PLAN_MEAL_TYPE = 'dinner';

export type PlanEntryKind = 'recipe' | 'outside' | 'legacy';
export interface PlanEntry {
  id: string;
  meal_date: string;
  meal_type: string;
  plan_kind?: 'meal' | 'outside';
  recipe_snapshot: { recipe_id?: string; title: string } | null;
  custom_name: string | null;
  consumed_at: string | null;
  deleted_at?: string | null;
}

const CIVIL = /^\d{4}-\d{2}-\d{2}$/;
export function isCivilDate(value: string): boolean {
  if (!CIVIL.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
export function addCivilDays(value: string, days: number): string {
  if (!isCivilDate(value)) throw new Error('INVALID_DATE');
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
export function isoWeekday(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}
export const mondayOf = (value: string): string => addCivilDays(value, 1 - isoWeekday(value));
export const weekDates = (from: string): string[] => Array.from({ length: 7 }, (_, i) => addCivilDays(from, i));
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number); const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Civil date of an instant in a zone. The zone defaults to the device zone. */
export function civilToday(now: Date = new Date(), timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...(timeZone ? { timeZone } : {}) }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export type WhenKind = 'today' | 'tomorrow';
export const resolveWhen = (kind: WhenKind, today: string): string => addCivilDays(today, kind === 'today' ? 0 : 1);

/** A date can be planned from today up to twelve weeks ahead. */
export function canPlanOn(date: string, today: string): boolean {
  if (!isCivilDate(date) || !isCivilDate(today)) return false;
  const delta = daysBetween(today, date);
  return delta >= 0 && delta <= PLAN_LIMITS.weeksAhead * 7;
}
/** Weeks are navigable eight back (read-only) and twelve ahead of the current one. */
export function weekInRange(from: string, today: string): boolean {
  if (!isCivilDate(from) || isoWeekday(from) !== 1) return false;
  const delta = daysBetween(mondayOf(today), from) / 7;
  return delta >= -PLAN_LIMITS.weeksBack && delta <= PLAN_LIMITS.weeksAhead;
}

export function classifyEntry(entry: PlanEntry): PlanEntryKind {
  if (entry.plan_kind === 'outside') return 'outside';
  if (entry.recipe_snapshot && entry.meal_type === PLAN_MEAL_TYPE && !entry.consumed_at) return 'recipe';
  return 'legacy';
}
const active = (entries: readonly PlanEntry[]) => entries.filter(e => !e.deleted_at);

export type ScheduleDecision = { ok: true } | { ok: false; reason: 'DATE_OUT_OF_RANGE' | 'DAY_FULL' | 'WEEK_FULL' | 'DAY_OUTSIDE' | 'ALREADY_PLANNED' };
export function canSchedule(entries: readonly PlanEntry[], date: string, today: string, recipeRef: string): ScheduleDecision {
  if (!canPlanOn(date, today)) return { ok: false, reason: 'DATE_OUT_OF_RANGE' };
  const live = active(entries);
  const day = live.filter(e => e.meal_date === date);
  if (day.some(e => classifyEntry(e) === 'outside')) return { ok: false, reason: 'DAY_OUTSIDE' };
  if (day.some(e => classifyEntry(e) === 'recipe' && e.recipe_snapshot?.recipe_id === recipeRef)) return { ok: false, reason: 'ALREADY_PLANNED' };
  if (day.filter(e => classifyEntry(e) === 'recipe').length >= PLAN_LIMITS.perDay) return { ok: false, reason: 'DAY_FULL' };
  const from = mondayOf(date); const to = addCivilDays(from, 6);
  if (live.filter(e => classifyEntry(e) === 'recipe' && e.meal_date >= from && e.meal_date <= to).length >= PLAN_LIMITS.perWeek) return { ok: false, reason: 'WEEK_FULL' };
  return { ok: true };
}
/** Choosing Cenar fuera retires the day's planned recipes; legacy entries are never touched. */
export const recipesToRetire = (entries: readonly PlanEntry[], date: string): PlanEntry[] =>
  active(entries).filter(e => e.meal_date === date && classifyEntry(e) === 'recipe');

export interface PlanDay { date: string; entries: PlanEntry[]; undecided: boolean; outside: boolean; readOnly: boolean }
export function buildWeek(entries: readonly PlanEntry[], from: string, today: string): PlanDay[] {
  const live = active(entries);
  return weekDates(from).map(date => {
    const list = live.filter(e => e.meal_date === date);
    const planned = list.filter(e => classifyEntry(e) !== 'legacy');
    return { date, entries: list, outside: list.some(e => classifyEntry(e) === 'outside'), undecided: planned.length === 0, readOnly: date < today };
  });
}

export const SCHEDULE_MESSAGES: Record<Exclude<ScheduleDecision & { ok: false }, never>['reason'], string> = {
  DATE_OUT_OF_RANGE: 'Elige una fecha desde hoy y hasta dentro de 12 semanas.',
  DAY_FULL: 'Ese día ya tiene 3 recetas.',
  WEEK_FULL: 'Esa semana ya tiene el máximo de recetas.',
  DAY_OUTSIDE: 'Ese día cenas fuera. Quita Cenar fuera para planificar una receta.',
  ALREADY_PLANNED: 'Esta receta ya está en tu plan ese día.',
};
