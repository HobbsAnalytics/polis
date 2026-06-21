import { it, expect } from '../testkit.ts';
import { createSeededCity } from './seed.ts';
import { CITY_VERSION } from './settings.ts';

it('seeded city matches the catalog: districts, borough, landmark, weighted habits', () => {
  const s = createSeededCity();
  expect(s.version).toBe(CITY_VERSION);
  expect(s.districts).toHaveLength(3);
  expect(s.boroughs).toHaveLength(1);
  expect(s.landmarks.length).toBeGreaterThanOrEqual(1);

  // habits exist for each targeting level
  const kinds = new Set(s.habits.map((h) => h.target.kind));
  expect(kinds.has('district')).toBe(true);
  expect(kinds.has('borough')).toBe(true);
  expect(kinds.has('landmark')).toBe(true);

  // a weight other than 1 came through from the catalog
  expect(s.habits.some((h) => h.weight === 2)).toBe(true);
});
