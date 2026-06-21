import { it, expect } from '../testkit.ts';
import { createSeededCity } from './seed.ts';

it('seeded city has placeholder districts, a landmark, and habits', () => {
  const s = createSeededCity();
  expect(s.districts).toHaveLength(3);
  expect(s.landmarks.length).toBeGreaterThanOrEqual(1);
  expect(s.habits.length).toBeGreaterThanOrEqual(3);
  // landmark has at least one habit targeting it
  const lm = s.landmarks[0];
  const lmHabits = s.habits.filter((h) => h.target.kind === 'landmark' && h.target.landmarkId === lm.id);
  expect(lmHabits.length).toBeGreaterThanOrEqual(1);
});
