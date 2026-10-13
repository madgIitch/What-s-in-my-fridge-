import { describe, expect, it } from 'vitest';
import { addCivilDays, buildWeek, canPlanOn, canSchedule, civilToday, classifyEntry, daysBetween, isCivilDate, mondayOf, recipesToRetire, resolveWhen, weekDates, weekInRange, type PlanEntry } from './week';

const entry = (patch: Partial<PlanEntry> = {}): PlanEntry => ({
  id: 'e1', meal_date: '2026-10-21', meal_type: 'dinner', recipe_snapshot: { recipe_id: 'import:a', title: 'Tortilla' }, custom_name: null, consumed_at: null, ...patch,
});

describe('R6 civil dates', () => {
  it('adds days on the civil calendar across both DST changes', () => {
    expect(addCivilDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addCivilDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addCivilDays('2027-03-27', 1)).toBe('2027-03-28');
    expect(addCivilDays('2027-03-28', 1)).toBe('2027-03-29');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(weekDates('2026-10-19')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  });
  it('finds Monday for any weekday', () => {
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
  });
  it('computes today in the user zone, not in UTC', () => {
    const lateMadridNight = new Date('2026-10-24T22:30:00Z');
    expect(civilToday(lateMadridNight, 'Europe/Madrid')).toBe('2026-10-25');
    expect(civilToday(lateMadridNight, 'UTC')).toBe('2026-10-24');
    expect(civilToday(new Date('2027-03-28T00:30:00Z'), 'Europe/Madrid')).toBe('2027-03-28');
    expect(civilToday(new Date('2026-10-25T23:30:00Z'), 'America/Los_Angeles')).toBe('2026-10-25');
  });
  it('resolves Hoy and Manana from the civil today', () => {
    expect(resolveWhen('today', '2026-10-24')).toBe('2026-10-24');
    expect(resolveWhen('tomorrow', '2026-10-24')).toBe('2026-10-25');
    expect(resolveWhen('tomorrow', '2026-12-31')).toBe('2027-01-01');
  });
  it('rejects invalid, past and too-far dates', () => {
    expect(isCivilDate('2026-02-30')).toBe(false);
    expect(canPlanOn('2026-10-12', '2026-10-13')).toBe(false);
    expect(canPlanOn('2026-10-13', '2026-10-13')).toBe(true);
    expect(canPlanOn('2027-01-05', '2026-10-13')).toBe(true);
    expect(canPlanOn('2027-01-06', '2026-10-13')).toBe(false);
    expect(weekInRange('2026-10-19', '2026-10-21')).toBe(true);
    expect(weekInRange('2026-10-20', '2026-10-21')).toBe(false);
    expect(weekInRange('2026-08-10', '2026-10-21')).toBe(false);
  });
});

describe('R6 plan rules', () => {
  it('classifies recipes, outside days and legacy entries', () => {
    expect(classifyEntry(entry())).toBe('recipe');
    expect(classifyEntry(entry({ plan_kind: 'outside', recipe_snapshot: null, custom_name: 'Cenar fuera' }))).toBe('outside');
    expect(classifyEntry(entry({ meal_type: 'lunch' }))).toBe('legacy');
    expect(classifyEntry(entry({ consumed_at: '2026-10-01T10:00:00Z' }))).toBe('legacy');
    expect(classifyEntry(entry({ recipe_snapshot: null, custom_name: 'Pasta' }))).toBe('legacy');
  });
  it('limits entries and keeps scheduling idempotent', () => {
    const day = (n: number) => Array.from({ length: n }, (_, i) => entry({ id: `d${i}`, recipe_snapshot: { recipe_id: `import:r${i}`, title: 'x' } }));
    expect(canSchedule(day(0), '2026-10-21', '2026-10-13', 'import:z')).toEqual({ ok: true });
    expect(canSchedule(day(3), '2026-10-21', '2026-10-13', 'import:z')).toEqual({ ok: false, reason: 'DAY_FULL' });
    expect(canSchedule(day(1), '2026-10-21', '2026-10-13', 'import:r0')).toEqual({ ok: false, reason: 'ALREADY_PLANNED' });
    expect(canSchedule([entry({ plan_kind: 'outside', recipe_snapshot: null, custom_name: 'Cenar fuera' })], '2026-10-21', '2026-10-13', 'import:z'))
      .toEqual({ ok: false, reason: 'DAY_OUTSIDE' });
    expect(canSchedule([], '2026-10-01', '2026-10-13', 'import:z')).toEqual({ ok: false, reason: 'DATE_OUT_OF_RANGE' });
  });
  it('retires only planned recipes when a day becomes Cenar fuera', () => {
    const legacy = entry({ id: 'l', meal_type: 'lunch' });
    expect(recipesToRetire([entry(), legacy, entry({ id: 'x', meal_date: '2026-10-22' })], '2026-10-21').map(e => e.id)).toEqual(['e1']);
  });
  it('marks undecided days and keeps legacy from deciding the day', () => {
    const week = buildWeek([entry(), entry({ id: 'l', meal_date: '2026-10-22', meal_type: 'lunch' })], '2026-10-19', '2026-10-20');
    expect(week).toHaveLength(7);
    expect(week[2]).toMatchObject({ date: '2026-10-21', undecided: false, outside: false });
    expect(week[3]).toMatchObject({ date: '2026-10-22', undecided: true });
    expect(week[0].readOnly).toBe(true);
    expect(week[1].readOnly).toBe(false);
  });
});
