import { it, expect } from '../testkit.ts';
import { habitDelta, createCity, addHabit, applyCheckIn, applyMissedDay } from './engine.ts';
import { DEFAULT_SETTINGS } from './settings.ts';
import type { Habit } from './types.ts';

const s = DEFAULT_SETTINGS;
const good = (over: Partial<Habit>): Habit => ({
  id: 'h', name: 'h', kind: 'good', weight: 1,
  target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-01-01', ...over,
});
const none = new Set<string>();

it('completed today deposits goodHabitGain * weight * emphasis', () => {
  const h = good({ cadence: 'weekly', lastCompletedISO: '2026-06-01' });
  const d = habitDelta([h], new Set(['h']), none, s, '2026-06-05');
  expect(Math.abs(d - s.goodHabitGain * 1 * Math.sqrt(7)) < 1e-6).toBe(true);
});

it('maintained (not done, within period) gives small upkeep positive', () => {
  const h = good({ cadence: 'weekly', lastCompletedISO: '2026-06-01' });
  const d = habitDelta([h], none, none, s, '2026-06-04'); // +3 < 7
  expect(Math.abs(d - s.upkeepDailyGain * 1 * Math.sqrt(7)) < 1e-6).toBe(true);
});

it('overdue erodes, growing with days overdue', () => {
  const h = good({ cadence: 'weekly', lastCompletedISO: '2026-06-01' });
  const at8 = habitDelta([h], none, none, s, '2026-06-08'); // dueToday (+7)
  const at11 = habitDelta([h], none, none, s, '2026-06-11'); // overdue 3
  expect(at8 < 0).toBe(true);
  expect(at11 < at8).toBe(true); // more overdue = more negative
});

it('daily equivalence: done = +goodHabitGain, missed next day = -overdueErosionBase (weight 1)', () => {
  const h = good({ cadence: 'daily', lastCompletedISO: '2026-06-10' });
  expect(Math.abs(habitDelta([h], new Set(['h']), none, s, '2026-06-11') - s.goodHabitGain) < 1e-6).toBe(true);
  expect(Math.abs(habitDelta([h], none, none, s, '2026-06-11') - -s.overdueErosionBase) < 1e-6).toBe(true);
});

it('applyCheckIn stamps lastCompletedISO on completed good habits', () => {
  let c = createCity({ boroughs: [{ id: 'b', districtId: 'd', name: 'b', healthDirect: 0.5 }], districts: [{ id: 'd', name: 'd', description: '', healthDirect: 0.5, maturity: 0, features: [] }] });
  c = addHabit(c, { id: 'h', name: 'h', kind: 'good', weight: 1, target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-06-01', cadence: 'weekly' });
  const after = applyCheckIn(c, { completedHabitIds: ['h'], loggedBadHabitIds: [], dateISO: '2026-06-05' });
  expect(after.habits.find((x) => x.id === 'h')?.lastCompletedISO).toBe('2026-06-05');
});

it('missed day leaves lastCompletedISO unchanged', () => {
  let c = createCity({ boroughs: [{ id: 'b', districtId: 'd', name: 'b', healthDirect: 0.5 }], districts: [{ id: 'd', name: 'd', description: '', healthDirect: 0.5, maturity: 0, features: [] }] });
  c = addHabit(c, { id: 'h', name: 'h', kind: 'good', weight: 1, target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-06-01', cadence: 'weekly', lastCompletedISO: '2026-06-01' });
  const after = applyMissedDay(c, '2026-06-03');
  expect(after.habits.find((x) => x.id === 'h')?.lastCompletedISO).toBe('2026-06-01');
});
