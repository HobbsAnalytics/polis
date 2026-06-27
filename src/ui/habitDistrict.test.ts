import { it, expect } from '../testkit.ts';
import { createSeededCity } from '../engine/seed.ts';
import { addHabit } from '../engine/engine.ts';
import type { Habit } from '../engine/types.ts';
import { habitDistrictId, habitsForDistrict, districtsWithHabits, districtBadgeCount } from './habitDistrict.ts';

function withBoroughHabit() {
  const city = createSeededCity();
  const borough = city.boroughs[0];
  const h: Habit = {
    id: 'h1', name: 'Read', kind: 'good', weight: 1,
    target: { kind: 'borough', id: borough.id }, createdAtISO: '2026-01-01',
    cadence: 'daily', lastCompletedISO: '2026-01-01', // long overdue vs a 2026-06 today
  };
  return { city: addHabit(city, h), districtId: borough.districtId };
}

it('habitDistrictId resolves a borough-targeted habit to its district', () => {
  const { city, districtId } = withBoroughHabit();
  expect(habitDistrictId(city, city.habits[city.habits.length - 1])).toBe(districtId);
});

it('habitsForDistrict returns that district\'s habits', () => {
  const { city, districtId } = withBoroughHabit();
  expect(habitsForDistrict(city, districtId).map((h) => h.id)).toEqual(['h1']);
});

it('districtsWithHabits lists only districts that have habits', () => {
  const { city, districtId } = withBoroughHabit();
  const ids = districtsWithHabits(city).map((d) => d.id);
  expect(ids).toEqual([districtId]);
});

it('districtBadgeCount counts overdue + due-today good habits', () => {
  const { city, districtId } = withBoroughHabit();
  expect(districtBadgeCount(city, districtId, '2026-06-27')).toBe(1);
});
