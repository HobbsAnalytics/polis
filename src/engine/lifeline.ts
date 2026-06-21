// Pure life-in-weeks math. No wall clock: today is passed in.
import type { Profile } from './types.ts';
import type { EraDef } from '../data/eras.ts';

const WEEKS_PER_YEAR = 52;
const MS_PER_WEEK = 7 * 86_400_000;

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
  const sunday = start + ((7 - dow) % 7) * 86_400_000;
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

export function buildLifeline(profile: Profile, todayISO: string, eras: EraDef[]): LifelineVM {
  const totalWeeks = profile.lifespanYears * WEEKS_PER_YEAR;
  const lived = Math.min(weeksLived(profile.birthDateISO, todayISO), totalWeeks);
  const age = ageYears(lived);
  const seenEra = new Set<string>();

  const years: YearRowVM[] = [];
  for (let y = 0; y < profile.lifespanYears; y++) {
    const era = currentEra(y, eras);
    const eraStart = !seenEra.has(era.id);
    seenEra.add(era.id);
    const weeks: WeekCellVM[] = [];
    for (let w = 0; w < WEEKS_PER_YEAR; w++) {
      const index = y * WEEKS_PER_YEAR + w;
      const status: WeekStatus = index < lived ? 'lived' : index === lived ? 'current' : 'future';
      weeks.push({ index, status });
    }
    years.push({ yearIndex: y, eraId: era.id, eraStart, weeks });
  }

  return {
    totalWeeks,
    weeksLived: lived,
    weeksLeft: Math.max(0, totalWeeks - lived),
    age,
    currentEraId: currentEra(age, eras).id,
    years,
  };
}
