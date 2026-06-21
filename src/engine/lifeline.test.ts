import { it, expect } from '../testkit.ts';
import { weeksLived, ageYears, currentEra, buildLifeline } from './lifeline.ts';
import { LIFE_ERAS } from '../data/eras.ts';
import type { Profile } from './types.ts';

it('weeksLived counts whole weeks since birth (clamped at 0)', () => {
  expect(weeksLived('2000-01-01', '2000-01-15')).toBe(2); // 14 days
  expect(weeksLived('2000-01-01', '1999-01-01')).toBe(0); // future birth → 0
});

it('ageYears is weeks / 52 floored', () => {
  expect(ageYears(104)).toBe(2);
  expect(ageYears(103)).toBe(1);
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
