import type { HabitCadence } from './types.ts';

const PERIOD: Record<HabitCadence, number> = {
  daily: 1,
  weekdays: 1,
  weekly: 7,
  twiceMonthly: 15,
  monthly: 30,
};

export function periodDays(c?: HabitCadence): number {
  return PERIOD[c ?? 'daily'];
}

/** Rarer habits matter somewhat more — sqrt(period), capped at 3x. */
export function cadenceEmphasis(c?: HabitCadence): number {
  return Math.min(3, Math.sqrt(periodDays(c)));
}
