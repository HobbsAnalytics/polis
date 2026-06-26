import { it, expect } from '../testkit.ts';
import {
  weeksLived,
  ageYears,
  currentEra,
  buildLifeline,
  weekSundayISO,
  weeklyHealthChange,
  weekTrend,
  birthdayInYear,
  lifeCell,
  lifeCellIndex,
} from './lifeline.ts';
import { LIFE_ERAS } from '../data/eras.ts';
import type { DayLog, Profile } from './types.ts';

const log = (dateISO: string, netHealthChange: number): DayLog => ({
  day: 0,
  dateISO,
  checkedIn: true,
  completedHabitIds: [],
  loggedBadHabitIds: [],
  netHealthChange,
  snapshot: { neighborhoods: [], landmarks: [] },
});

it('weeksLived counts whole weeks since birth (clamped at 0)', () => {
  expect(weeksLived('2000-01-01', '2000-01-15')).toBe(2); // 14 days
  expect(weeksLived('2000-01-01', '1999-01-01')).toBe(0); // future birth → 0
});

it('ageYears is weeks / 52 floored', () => {
  expect(ageYears(104)).toBe(2);
  expect(ageYears(103)).toBe(1);
});

it('weeklyHealthChange sums each day into its birthday-anchored week; weekTrend bands it', () => {
  const birth = '2000-01-01';
  // Two days in the same first week, one in a later week. Dateless logs are ignored.
  const m = weeklyHealthChange(
    [log('2000-01-02', 0.2), log('2000-01-03', -0.05), log('2000-02-01', -0.3), log('', 99)],
    birth,
  );
  expect(Math.abs((m.get(0) ?? 0) - 0.15) < 1e-9).toBe(true); // 0.2 - 0.05
  expect(weekTrend(m.get(0))).toBe('up');
  expect(weekTrend(m.get(weekIndexFor(birth, '2000-02-01')))).toBe('down');
  // No entry for an untouched week → 'none'
  expect(weekTrend(m.get(500))).toBe('none');
});

it('weekTrend thresholds: flat band straddles zero', () => {
  expect(weekTrend(0.005)).toBe('flat');
  expect(weekTrend(-0.005)).toBe('flat');
  expect(weekTrend(0.05)).toBe('slight-up');
  expect(weekTrend(-0.05)).toBe('slight-down');
});

// local helper mirrors dates.weekIndex without importing it into the test surface
function weekIndexFor(birthISO: string, dateISO: string): number {
  return Math.floor((Date.parse(dateISO) - Date.parse(birthISO)) / (7 * 86_400_000));
}

it('weekSundayISO returns the Sunday within each birthday-anchored week', () => {
  // 2000-01-02 is a Sunday → week 0 is itself; week 1 is the next Sunday.
  expect(weekSundayISO('2000-01-02', 0)).toBe('2000-01-02');
  expect(weekSundayISO('2000-01-02', 1)).toBe('2000-01-09');
  // 2000-01-01 is a Saturday → its week's Sunday is the next day.
  expect(weekSundayISO('2000-01-01', 0)).toBe('2000-01-02');
  // Result is always a Sunday.
  expect(new Date(weekSundayISO('1988-11-01', 500)).getUTCDay()).toBe(0);
});

it('currentEra matches range boundaries and clamps past lifespan', () => {
  expect(currentEra(0, LIFE_ERAS).id).toBe('wonder');
  expect(currentEra(5, LIFE_ERAS).id).toBe('wonder');
  expect(currentEra(6, LIFE_ERAS).id).toBe('discovery');
  expect(currentEra(37, LIFE_ERAS).id).toBe('ascent');
  expect(currentEra(38, LIFE_ERAS).id).toBe('dominion');
  expect(currentEra(75, LIFE_ERAS).id).toBe('legacy');
  expect(currentEra(120, LIFE_ERAS).id).toBe('legacy');
});

it('buildLifeline: totals add up and the scenario lands in Age of Ascent at 37', () => {
  const profile: Profile = { birthDateISO: '1988-11-01', lifespanYears: 75 };
  const vm = buildLifeline(profile, '2026-06-21', LIFE_ERAS);
  expect(vm.totalWeeks).toBe(3900);
  expect(vm.age).toBe(37);
  expect(vm.currentEraId).toBe('ascent');
  expect(vm.weeksLived + vm.weeksLeft).toBe(3900);

  const cells = vm.years.flatMap((y) => y.weeks);
  expect(cells).toHaveLength(3900);
  const lived = cells.filter((c) => c.status === 'lived').length;
  const current = cells.filter((c) => c.status === 'current').length;
  const future = cells.filter((c) => c.status === 'future').length;
  expect(current).toBe(1);
  expect(lived).toBe(vm.weeksLived);
  expect(lived + current + future).toBe(3900);
});

it('era bands: each era labels its first year exactly once', () => {
  const profile: Profile = { birthDateISO: '1988-11-01', lifespanYears: 75 };
  const vm = buildLifeline(profile, '2026-06-21', LIFE_ERAS);
  const starts = vm.years.filter((y) => y.eraStart).map((y) => y.eraId);
  expect(starts).toEqual(LIFE_ERAS.map((e) => e.id));
});

it('birthdayInYear returns the birthday in the given calendar year', () => {
  expect(birthdayInYear('1988-11-26', 1990)).toBe('1990-11-26');
  expect(birthdayInYear('1988-11-26', 2025)).toBe('2025-11-26');
});

it('birthdayInYear clamps Feb-29 to Feb-28 in non-leap years', () => {
  expect(birthdayInYear('2000-02-29', 2001)).toBe('2001-02-28');
  expect(birthdayInYear('2000-02-29', 2004)).toBe('2004-02-29');
});

it('lifeCell puts the birthday on cell 0 of the right row, every year', () => {
  const b = '1988-11-26';
  expect(lifeCell(b, '1988-11-26')).toEqual({ row: 0, cell: 0 });
  expect(lifeCell(b, '1990-11-26')).toEqual({ row: 2, cell: 0 });
  expect(lifeCell(b, '2025-11-26')).toEqual({ row: 37, cell: 0 });
});

it('lifeCell steps weeks within a row and caps the final cell at 51', () => {
  const b = '1988-11-26';
  expect(lifeCell(b, '1988-12-03')).toEqual({ row: 0, cell: 1 }); // +7 days
  // day 360 of the year → past 51*7=357 → capped at 51, NOT spilling to row 1
  expect(lifeCell(b, '1989-11-21')).toEqual({ row: 0, cell: 51 });
});

it('lifeCell returns null before birth; lifeCellIndex returns -1', () => {
  expect(lifeCell('1988-11-26', '1988-11-25')).toBeNull();
  expect(lifeCellIndex('1988-11-26', '1988-11-25')).toBe(-1);
});

it('lifeCellIndex = row*52 + cell', () => {
  expect(lifeCellIndex('1988-11-26', '1990-11-26')).toBe(104);
});

it('weeklyHealthChange buckets days into birthday-anchored cells', () => {
  const b = '1988-11-26';
  const m = weeklyHealthChange(
    [log('1988-11-26', 0.2), log('1988-11-27', -0.05), log('1990-11-26', -0.3), log('', 99)],
    b,
  );
  expect(Math.abs((m.get(0) ?? 0) - 0.15) < 1e-9).toBe(true);  // both first-row, cell 0
  expect(Math.abs((m.get(104) ?? 0) - (-0.3)) < 1e-9).toBe(true); // row 2 cell 0
  expect(m.get(undefined as unknown as number)).toBe(undefined);
});

it('buildLifeline marks the today cell as current and prior cells lived', () => {
  const profile = { name: 'x', birthDateISO: '1988-11-26', lifespanYears: 75, startDateISO: '2020-01-01' };
  const vm = buildLifeline(profile, '1990-12-03', LIFE_ERAS); // row 2, cell ~1
  const row2 = vm.years[2];
  expect(row2.weeks[0].status).toBe('lived');
  expect(row2.weeks[1].status).toBe('current');
  expect(row2.weeks[2].status).toBe('future');
  expect(vm.age).toBe(2);
});
