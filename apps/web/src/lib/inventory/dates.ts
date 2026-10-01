export function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

export function formatCivilDate(value: string, locale = "es-ES"): string {
  if (!isCivilDate(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function utcNow(): string {
  return new Date().toISOString();
}

/** Local civil date; intentionally avoids UTC-midnight conversion. */
export function localCivilDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function purchasedLabel(value: string, source: "receipt" | "user", locale = "es-ES", now = new Date()): string {
  if (!isCivilDate(value)) return "Compra sin fecha";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = localCivilDate(now);
  const isToday = value === today;
  const label = isToday ? "hoy" : new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  return source === "receipt" ? `Comprado${isToday ? "" : " el"} ${label}` : `Añadido${isToday ? "" : " el"} ${label}`;
}

export function estimatedWindowLabel(days: number): string {
  const safe = Math.max(0, Math.round(days));
  return safe >= 14 && safe % 7 === 0 ? `unos ${safe / 7} semanas` : `unos ${safe} días`;
}
