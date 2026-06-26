// Shared, pure date/time helpers. No wall clock except `todayISO()` (the one
// intentional impure helper). Everything else takes ISO strings so the engine
// and view math stay deterministic and testable.

export const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD from a Date's LOCAL components (not UTC). */
export function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as YYYY-MM-DD (local). The only clock-reading helper. */
export function todayISO(): string {
  return localDateISO(new Date());
}

/** Whole calendar days from aISO to bISO (rounded). */
export function dayDiffISO(aISO: string, bISO: string): number {
  return Math.round((Date.parse(bISO) - Date.parse(aISO)) / MS_PER_DAY);
}

/** `iso` shifted by `n` days, as YYYY-MM-DD. */
export function addDaysISO(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole weeks from birthDateISO to dateISO (floored; may be negative). */
export function weekIndex(birthDateISO: string, dateISO: string): number {
  return Math.floor((Date.parse(dateISO) - Date.parse(birthDateISO)) / MS_PER_WEEK);
}
