// src/ui/checkinGroups.test.ts
import { it, expect } from '../testkit.ts';
import { groupGoodHabits } from './checkinGroups.ts';
import type { Habit } from '../engine/types.ts';

const g = (id: string, over: Partial<Habit>): Habit => ({
  id, name: id, kind: 'good', weight: 1,
  target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-06-01', ...over,
});

it('buckets good habits by status; ignores bad habits', () => {
  const habits: Habit[] = [
    g('m', { cadence: 'weekly', lastCompletedISO: '2026-06-08' }),   // +2 maintained
    g('d', { cadence: 'weekly', lastCompletedISO: '2026-06-03' }),   // +7 dueToday
    g('o', { cadence: 'weekly', lastCompletedISO: '2026-05-30' }),   // +11 overdue
    { ...g('bad', {}), kind: 'bad' },
  ];
  const r = groupGoodHabits(habits, '2026-06-10');
  expect(r.maintained.map((x) => x.habit.id)).toEqual(['m']);
  expect(r.dueToday.map((x) => x.habit.id)).toEqual(['d']);
  expect(r.overdue.map((x) => x.habit.id)).toEqual(['o']);
});
