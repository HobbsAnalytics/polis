// Pure life-in-weeks math. No wall clock: today is passed in.
import type { DayLog, Profile } from './types.ts';
import type { EraDef } from '../data/eras.ts';
import { MS_PER_DAY, MS_PER_WEEK } from './dates.ts';

const WEEKS_PER_YEAR = 52;

const pad = (n: number) => String(n).padStart(2, '0');

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** The birthday within `calendarYear`; Feb-29 clamps to Feb-28 off leap years. */
export function birthdayInYear(birthDateISO: string, calendarYear: number): string {
  const [, mm, dd] = birthDateISO.split('-').map(Number);
  let day = dd;
  if (mm === 2 && dd === 29 && !isLeap(calendarYear)) day = 28;
  return `${calendarYear}-${pad(mm)}-${pad(day)}`;
}

/** Row = whole-year age; cell = capped week offset from that year's birthday. */
export function lifeCell(
  birthDateISO: string,
  dateISO: string,
): { row: number; cell: number } | null {
  if (Date.parse(dateISO) < Date.parse(birthDateISO)) return null;
  const birthY = Number(birthDateISO.slice(0, 4));
  const dateY = Number(dateISO.slice(0, 4));
  // Walk down from an upper-bound year to the birthday-year the date falls in.
  let row = dateY - birthY;
  while (row >= 0 && Date.parse(birthdayInYear(birthDateISO, birthY + row)) > Date.parse(dateISO)) {
    row -= 1;
  }
  const anchor = birthdayInYear(birthDateISO, birthY + row);
  const days = Math.floor((Date.parse(dateISO) - Date.parse(anchor)) / MS_PER_DAY);
  const cell = Math.min(51, Math.floor(days / 7));
  return { row, cell };
}

export function lifeCellIndex(birthDateISO: string, dateISO: string): number {
  const c = lifeCell(birthDateISO, dateISO);
  return c ? c.row * WEEKS_PER_YEAR + c.cell : -1;
}

export function weeksLived(birthDateISO: string, todayISO: string): number {
  const ms = Date.parse(todayISO) - Date.parse(birthDateISO);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / MS_PER_WEEK);
}

export function ageYears(weeks: number): number {
  return Math.floor(weeks / WEEKS_PER_YEAR);
}

/** The Sunday (YYYY-MM-DD, UTC) falling within the birthday-anchored week `index`. */
export function weekSundayISO(birthDateISO: string, index: number): string {
  const start = Date.parse(birthDateISO) + index * MS_PER_WEEK;
  const dow = new Date(start).getUTCDay(); // 0 = Sunday
  const sunday = start + ((7 - dow) % 7) * MS_PER_DAY;
  return new Date(sunday).toISOString().slice(0, 10);
}

/** Era whose age range covers `age`; clamps to the last era beyond lifespan. */
export function currentEra(age: number, eras: EraDef[]): EraDef {
  const match = eras.find((e) => age >= e.startAge && age <= e.endAge);
  return match ?? eras[eras.length - 1];
}

export type WeekStatus = 'lived' | 'current' | 'future';

export interface WeekCellVM {
  index: number;
  status: WeekStatus;
}

export interface YearRowVM {
  yearIndex: number;
  eraId: string;
  eraStart: boolean; // first year of its era → label prints here
  weeks: WeekCellVM[];
}

export interface LifelineVM {
  totalWeeks: number;
  weeksLived: number;
  weeksLeft: number;
  age: number;
  currentEraId: string;
  years: YearRowVM[];
}

/**
 * How the city fared over a week, from the summed net health change of its days.
 * 'none' = no recorded activity that week (box keeps its lived/future shade).
 */
export type WeekTrend = 'up' | 'slight-up' | 'flat' | 'slight-down' | 'down' | 'none';

/** Sum each day's net health change into its birthday-anchored week. */
export function weeklyHealthChange(log: DayLog[], birthDateISO: string): Map<number, number> {
  const byCell = new Map<number, number>();
  for (const d of log) {
    if (!d.dateISO) continue;
    const idx = lifeCellIndex(birthDateISO, d.dateISO);
    if (idx < 0) continue;
    byCell.set(idx, (byCell.get(idx) ?? 0) + d.netHealthChange);
  }
  return byCell;
}

/** Bucket a week's net change into a trend band. Thresholds are deliberately gentle. */
export function weekTrend(net: number | undefined): WeekTrend {
  if (net === undefined) return 'none';
  if (net > 0.1) return 'up';
  if (net > 0.01) return 'slight-up';
  if (net >= -0.01) return 'flat';
  if (net >= -0.1) return 'slight-down';
  return 'down';
}

export function buildLifeline(profile: Profile, todayISO: string, eras: EraDef[]): LifelineVM {
  const totalWeeks = profile.lifespanYears * WEEKS_PER_YEAR;
  const todayCell = lifeCell(profile.birthDateISO, todayISO); // null if before birth
  const curRow = todayCell ? todayCell.row : -1;
  const curCell = todayCell ? todayCell.cell : -1;
  const livedIndex = todayCell ? curRow * WEEKS_PER_YEAR + curCell : 0;
  const age = Math.max(0, curRow);
  const seenEra = new Set<string>();

  const years: YearRowVM[] = [];
  for (let y = 0; y < profile.lifespanYears; y++) {
    const era = currentEra(y, eras);
    const eraStart = !seenEra.has(era.id);
    seenEra.add(era.id);
    const weeks: WeekCellVM[] = [];
    for (let w = 0; w < WEEKS_PER_YEAR; w++) {
      const index = y * WEEKS_PER_YEAR + w;
      const status: WeekStatus =
        index < livedIndex ? 'lived' : index === livedIndex ? 'current' : 'future';
      weeks.push({ index, status });
    }
    years.push({ yearIndex: y, eraId: era.id, eraStart, weeks });
  }

  const weeksLivedVal = todayCell ? curRow * WEEKS_PER_YEAR + curCell : 0;
  return {
    totalWeeks,
    weeksLived: weeksLivedVal,
    weeksLeft: Math.max(0, totalWeeks - weeksLivedVal),
    age,
    currentEraId: currentEra(age, eras).id,
    years,
  };
}
