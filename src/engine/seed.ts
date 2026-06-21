import type { Borough, CityState, District, Habit } from './types.ts';
import { createCity, addLandmark, addHabit } from './engine.ts';
import { BOROUGHS, DISTRICTS, HABITS, SEED_CREATED_ISO, SEED_LANDMARK } from '../data/catalog.ts';

/** Builds the initial CityState from the catalog file. */
export function createSeededCity(): CityState {
  const districts: District[] = DISTRICTS.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    healthDirect: 0.5,
    maturity: 0,
    features: [],
  }));
  const boroughs: Borough[] = BOROUGHS.map((b) => ({
    id: b.id,
    districtId: b.districtId,
    name: b.name,
    healthDirect: 0.5,
  }));
  const habits: Habit[] = HABITS.map((h) => ({
    id: h.id,
    name: h.name,
    kind: h.kind,
    weight: h.weight,
    target: h.target,
    createdAtISO: SEED_CREATED_ISO,
  }));

  let s = createCity({ districts, boroughs, habits });

  // Seed landmark with its own good + bad habit.
  const r = addLandmark(s, {
    districtId: SEED_LANDMARK.districtId,
    boroughId: SEED_LANDMARK.boroughId,
    name: SEED_LANDMARK.name,
    condition: 0.5,
  });
  s = r.state;
  s = addHabit(s, {
    id: SEED_LANDMARK.goodHabit.id,
    name: SEED_LANDMARK.goodHabit.name,
    kind: 'good',
    weight: SEED_LANDMARK.goodHabit.weight,
    target: { kind: 'landmark', id: r.landmarkId },
    createdAtISO: SEED_CREATED_ISO,
  });
  s = addHabit(s, {
    id: SEED_LANDMARK.badHabit.id,
    name: SEED_LANDMARK.badHabit.name,
    kind: 'bad',
    weight: SEED_LANDMARK.badHabit.weight,
    target: { kind: 'landmark', id: r.landmarkId },
    createdAtISO: SEED_CREATED_ISO,
  });

  return s;
}
