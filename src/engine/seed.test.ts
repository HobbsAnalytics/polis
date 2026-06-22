import { it, expect } from '../testkit.ts';
import { createSeededCity } from './seed.ts';
import { CITY_VERSION } from './settings.ts';

it('seeded city is a minimal scaffold: a single "Home" district, nothing else', () => {
  const s = createSeededCity();
  expect(s.version).toBe(CITY_VERSION);
  expect(s.profile.name).toBe('');

  // exactly one starter district named "Home", using the addDistrict id scheme
  expect(s.districts).toHaveLength(1);
  expect(s.districts[0].name).toBe('Home');
  expect(s.districts[0].id).toBe('district-1');

  // no sample content
  expect(s.boroughs).toHaveLength(0);
  expect(s.habits).toHaveLength(0);
  expect(s.landmarks).toHaveLength(0);
});
