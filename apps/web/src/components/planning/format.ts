import { addCivilDays } from '../../../../../packages/domain/src/planning/week';

const utc = (date: string) => { const [y, m, d] = date.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
/** Spanish day label from a civil date; formatted in UTC so the zone never shifts the day. */
export function formatDay(date: string, today: string): string {
  if (date === today) return 'hoy';
  if (date === addCivilDays(today, 1)) return 'mañana';
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(utc(date));
}
export const formatWeekday = (date: string) => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(utc(date));
export function formatRange(from: string): string {
  const to = addCivilDays(from, 6);
  const f = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${f.format(utc(from))} – ${f.format(utc(to))}`;
}
