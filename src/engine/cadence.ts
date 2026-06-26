import type { HabitCadence } from './types.ts';
import { dayDiffISO } from './dates.ts';

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

export interface HabitStatus {
  state: 'maintained' | 'dueToday' | 'overdue';
  dueInDays: number;
  daysOverdue: number;
}

function isWeekend(iso: string): boolean {
  const dow = new Date(iso + 'T00:00:00').getDay(); // 0=Sun..6=Sat
  return dow === 0 || dow === 6;
}

function daysToNextWeekday(iso: string): number {
  const dow = new Date(iso + 'T00:00:00').getDay();
  return dow === 6 ? 2 : dow === 0 ? 1 : 0;
}

function weekdaysSince(anchorISO: string, todayISO: string): number {
  // Count only weekdays (Mon-Fri) between anchor and today
  const calendarDays = dayDiffISO(anchorISO, todayISO);
  let weekdayCount = 0;
  for (let i = 0; i <= calendarDays; i++) {
    const checkDate = new Date(Date.parse(anchorISO) + i * 86_400_000);
    const iso = checkDate.toISOString().slice(0, 10);
    if (!isWeekend(iso)) {
      weekdayCount++;
    }
  }
  return weekdayCount - 1; // Subtract 1 to exclude the anchor day itself
}

export function habitStatus(args: {
  cadence?: HabitCadence;
  anchorISO: string;
  todayISO: string;
}): HabitStatus {
  const { cadence, anchorISO, todayISO } = args;
  if (cadence === 'weekdays' && isWeekend(todayISO)) {
    return { state: 'maintained', dueInDays: daysToNextWeekday(todayISO), daysOverdue: 0 };
  }
  const period = periodDays(cadence);
  const daysSince = cadence === 'weekdays' ? weekdaysSince(anchorISO, todayISO) : dayDiffISO(anchorISO, todayISO);
  if (daysSince < period) return { state: 'maintained', dueInDays: period - daysSince, daysOverdue: 0 };
  if (daysSince === period) return { state: 'dueToday', dueInDays: 0, daysOverdue: 0 };
  return { state: 'overdue', dueInDays: 0, daysOverdue: daysSince - period };
}
