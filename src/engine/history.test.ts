import { it, expect } from '../testkit.ts';
import { createCity, applyCheckIn, addHabit, addDistrict } from './engine.ts';
import { cityAtSnapshot } from './history.ts';
import { buildCityViewModel } from './viewModel.ts';
import type { District, Habit, TargetRef } from './types.ts';

const dist = (id: string, healthDirect = 0.5): District => ({
  id,
  name: id,
  description: '',
  healthDirect,
  maturity: 0,
  features: [],
});
const hab = (id: string, kind: Habit['kind'], target: TargetRef): Habit => ({
  id,
  name: id,
  kind,
  weight: 1,
  target,
  createdAtISO: '2026-01-01',
});

it('cityAtSnapshot restores a past day from its log snapshot', () => {
  let s = createCity({ districts: [dist('d1')] });
  s = addHabit(s, hab('g', 'good', { kind: 'district', id: 'd1' }));
  // Day 1: improve. Day 2: improve again.
  s = applyCheckIn(s, { completedHabitIds: ['g'], loggedBadHabitIds: [], dateISO: '2026-06-20' });
  const healthsDay1 = s.neighborhoods.map((n) => n.health);
  s = applyCheckIn(s, { completedHabitIds: ['g'], loggedBadHabitIds: [], dateISO: '2026-06-21' });

  // Reconstruct day 1 from its snapshot; healths match that day, not the latest.
  const day1 = cityAtSnapshot(s, s.log[0].snapshot);
  expect(day1.neighborhoods.map((n) => Math.round(n.health * 1000))).toEqual(
    healthsDay1.map((h) => Math.round(h * 1000)),
  );
  // The reconstructed state still builds a valid view model.
  expect(buildCityViewModel(day1).districts[0].generic.length).toBe(s.neighborhoods.length);
});

it('cityAtSnapshot drops entities that did not exist on that day', () => {
  let s = createCity({ districts: [dist('d1')] });
  s = applyCheckIn(s, { completedHabitIds: [], loggedBadHabitIds: [], dateISO: '2026-06-20' });
  const earlySnapshot = s.log[0].snapshot;
  // A second district is added later; its buildings are absent from the early snapshot.
  s = addDistrict(s, { name: 'Later' }).state;
  const past = cityAtSnapshot(s, earlySnapshot);
  expect(past.neighborhoods.every((n) => n.districtId === 'd1')).toBe(true);
  expect(past.neighborhoods.length).toBeLessThan(s.neighborhoods.length);
});
