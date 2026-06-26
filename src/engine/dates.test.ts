import { it, expect } from '../testkit.ts';
import { localDateISO, addDaysISO, dayDiffISO } from './dates.ts';

it('localDateISO uses local Y/M/D, not the UTC slice', () => {
  // 2026-06-26 21:30 local — must return that local date even though, in a
  // UTC-negative offset, toISOString() would already read 2026-06-27.
  const d = new Date(2026, 5, 26, 21, 30, 0); // month is 0-based → June
  expect(localDateISO(d)).toBe('2026-06-26');
});

it('localDateISO zero-pads month and day', () => {
  expect(localDateISO(new Date(2026, 0, 5, 0, 0, 0))).toBe('2026-01-05');
});

it('addDaysISO / dayDiffISO still round-trip', () => {
  expect(addDaysISO('2026-06-26', 1)).toBe('2026-06-27');
  expect(dayDiffISO('2026-06-26', '2026-06-28')).toBe(2);
});
