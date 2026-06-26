import { it, expect } from '../testkit.ts';
import { periodDays, cadenceEmphasis, habitStatus } from './cadence.ts';

it('periodDays maps each cadence; missing defaults to daily', () => {
  expect(periodDays('daily')).toBe(1);
  expect(periodDays('weekdays')).toBe(1);
  expect(periodDays('weekly')).toBe(7);
  expect(periodDays('twiceMonthly')).toBe(15);
  expect(periodDays('monthly')).toBe(30);
  expect(periodDays(undefined)).toBe(1);
});

it('cadenceEmphasis is sqrt(period) capped at 3; daily is 1', () => {
  expect(cadenceEmphasis('daily')).toBe(1);
  expect(Math.abs(cadenceEmphasis('weekly') - Math.sqrt(7)) < 1e-6).toBe(true);
  expect(cadenceEmphasis('twiceMonthly')).toBe(3); // sqrt(15)≈3.87 capped
  expect(cadenceEmphasis('monthly')).toBe(3);
  expect(cadenceEmphasis(undefined)).toBe(1);
});

it('weekly: maintained within period, due at period, overdue after', () => {
  const a = '2026-06-01';
  expect(habitStatus({ cadence: 'weekly', anchorISO: a, todayISO: '2026-06-04' }).state).toBe('maintained'); // +3
  expect(habitStatus({ cadence: 'weekly', anchorISO: a, todayISO: '2026-06-04' }).dueInDays).toBe(4);
  expect(habitStatus({ cadence: 'weekly', anchorISO: a, todayISO: '2026-06-08' }).state).toBe('dueToday'); // +7
  const od = habitStatus({ cadence: 'weekly', anchorISO: a, todayISO: '2026-06-11' }); // +10
  expect(od.state).toBe('overdue');
  expect(od.daysOverdue).toBe(3);
});

it('daily: due the day after completion (legacy behavior anchor)', () => {
  expect(habitStatus({ cadence: 'daily', anchorISO: '2026-06-10', todayISO: '2026-06-11' }).state).toBe('dueToday');
});

it('weekdays: weekend is neutral (maintained)', () => {
  // 2026-06-13 is a Saturday, 2026-06-14 Sunday, 2026-06-15 Monday
  expect(habitStatus({ cadence: 'weekdays', anchorISO: '2026-06-12', todayISO: '2026-06-13' }).state).toBe('maintained');
  expect(habitStatus({ cadence: 'weekdays', anchorISO: '2026-06-12', todayISO: '2026-06-15' }).state).toBe('dueToday');
});
