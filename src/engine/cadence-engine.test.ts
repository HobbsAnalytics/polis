import { it, expect } from '../testkit.ts';
import { habitDelta } from './engine.ts';
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
