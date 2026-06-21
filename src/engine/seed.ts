import type { CityState, District } from './types.ts';
import { createCity, addLandmark, addHabit } from './engine.ts';

/**
 * Placeholder content. Districts and habits are intentionally generic — swap them
 * for your finalized framework (virtues / PERMA / etc.) without touching engine code.
 */
export function createSeededCity(): CityState {
  const districts: District[] = [
    { id: 'd1', name: 'District One', description: 'Placeholder wellbeing domain.', health: 0.5 },
    { id: 'd2', name: 'District Two', description: 'Placeholder wellbeing domain.', health: 0.5 },
    { id: 'd3', name: 'District Three', description: 'Placeholder wellbeing domain.', health: 0.5 },
  ];

  let s = createCity({ districts });

  // District-level placeholder habits (feed generic sprawl).
  s = addHabit(s, { id: 'h-d1-good', name: 'Placeholder good habit (D1)', kind: 'good', target: { kind: 'district', districtId: 'd1' } });
  s = addHabit(s, { id: 'h-d2-good', name: 'Placeholder good habit (D2)', kind: 'good', target: { kind: 'district', districtId: 'd2' } });

  // One placeholder landmark in District One, with its own good + bad habits.
  const r = addLandmark(s, { districtId: 'd1', name: 'Placeholder Landmark', condition: 0.5 });
  s = r.state;
  s = addHabit(s, { id: 'h-lm-good', name: 'Placeholder good habit (landmark)', kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  s = addHabit(s, { id: 'h-lm-bad', name: 'Placeholder bad habit (landmark)', kind: 'bad', target: { kind: 'landmark', landmarkId: r.landmarkId } });

  return s;
}
