import { it, expect } from '../testkit.ts';
import { periodDays, cadenceEmphasis } from './cadence.ts';

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
