// src/ui/checkinGroups.ts
import type { Habit } from '../engine/types.ts';
import { habitStatus, type HabitStatus } from '../engine/cadence.ts';

export interface GroupedHabit { habit: Habit; status: HabitStatus; }

export function groupGoodHabits(habits: Habit[], todayISO: string) {
  const overdue: GroupedHabit[] = [];
  const dueToday: GroupedHabit[] = [];
  const maintained: GroupedHabit[] = [];
  for (const habit of habits) {
    if (habit.kind !== 'good') continue;
    const status = habitStatus({ cadence: habit.cadence, anchorISO: habit.lastCompletedISO ?? habit.createdAtISO, todayISO });
    (status.state === 'overdue' ? overdue : status.state === 'dueToday' ? dueToday : maintained).push({ habit, status });
  }
  const byName = (a: GroupedHabit, b: GroupedHabit) => a.habit.name.localeCompare(b.habit.name);
  return { overdue: overdue.sort(byName), dueToday: dueToday.sort(byName), maintained: maintained.sort(byName) };
}
