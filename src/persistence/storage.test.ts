import { it, expect, beforeEach } from '../testkit.ts';
import { saveCity, loadCity, exportCity, importCity, catchUpMissedDays } from './storage.ts';
import { createSeededCity } from '../engine/seed.ts';
import { createCity } from '../engine/engine.ts';
import type { CityState, District } from '../engine/types.ts';

const dist = (id: string, healthDirect = 0.5): District => ({
  id,
  name: id,
  description: '',
  healthDirect,
  maturity: 0,
  features: [],
});

/** A v6-shaped save with district-direct items (a borough-less district). */
function v6Save(extra: Partial<Record<string, unknown>> = {}): CityState {
  const base = createCity({ districts: [dist('d1')] });
  return {
    ...base,
    version: 6,
    boroughs: [],
    landmarks: [
      { id: 'lm1', districtId: 'd1', boroughId: null, name: 'L', condition: 0.5, tier: 0, tierProgress: 0, createdDay: 0 },
    ],
    neighborhoods: [{ id: 'nb1', districtId: 'd1', boroughId: null, health: 0.5, createdDay: 0 }],
    habits: [
      { id: 'h1', name: 'h1', kind: 'good', weight: 1, target: { kind: 'district', id: 'd1' }, createdAtISO: '2026-01-01' },
    ],
    ...extra,
  } as unknown as CityState;
}

beforeEach(() => {
  localStorage.clear();
});

it('save then load round-trips', () => {
  const s = createSeededCity();
  saveCity(s);
  expect(loadCity()).toEqual(s);
});

it('loadCity returns null when nothing stored', () => {
  expect(loadCity()).toBeNull();
});

it('loadCity returns null for an unknown stale version', () => {
  const s = createSeededCity();
  saveCity({ ...s, version: 999 });
  expect(loadCity()).toBeNull();
});

it('migrates a v2 save (no profile/milestones) up to current with defaults', () => {
  const s = createSeededCity();
  const { profile: _p, milestones: _m, ...old } = s;
  saveCity({ ...old, version: 2 } as unknown as typeof s);
  const loaded = loadCity();
  expect(loaded?.version).toBe(7);
  expect(loaded?.profile.lifespanYears).toBe(75);
  expect(loaded?.profile.name).toBe('');
  expect(loaded?.milestones).toEqual([]);
});

it('migrates a v3 save (no milestones) up to current', () => {
  const s = createSeededCity();
  const { milestones: _m, ...old } = s;
  saveCity({ ...old, version: 3 } as unknown as typeof s);
  const loaded = loadCity();
  expect(loaded?.version).toBe(7);
  expect(loaded?.milestones).toEqual([]);
});

it('migrates a v4 save (no profile.name) up to current with an empty name', () => {
  const s = createSeededCity();
  const { name: _n, ...profileNoName } = s.profile;
  saveCity({ ...s, profile: profileNoName, version: 4 } as unknown as typeof s);
  const loaded = loadCity();
  expect(loaded?.version).toBe(7);
  expect(loaded?.profile.name).toBe('');
  expect(loaded?.profile.birthDateISO).toBe(s.profile.birthDateISO);
});

it('migrates v6 → v7: back-fills a General borough and re-homes district-direct items', () => {
  saveCity(v6Save());
  const loaded = loadCity()!;
  expect(loaded.version).toBe(7);
  const gen = loaded.boroughs.find((b) => b.districtId === 'd1' && b.name === 'General')!;
  expect(gen).toBeTruthy();
  // habit, landmark, and neighborhood all re-parent onto the General borough
  expect(loaded.habits[0].target).toEqual({ kind: 'borough', id: gen.id });
  expect(loaded.landmarks[0].boroughId).toBe(gen.id);
  expect(loaded.neighborhoods.find((n) => n.id === 'nb1')!.boroughId).toBe(gen.id);
  // nothing deleted
  expect(loaded.habits).toHaveLength(1);
  expect(loaded.landmarks).toHaveLength(1);
  expect(loaded.neighborhoods.find((n) => n.id === 'nb1')).toBeTruthy();
});

it('v6 → v7 re-homes district-direct items into the existing first borough', () => {
  saveCity(
    v6Save({
      boroughs: [{ id: 'b-existing', districtId: 'd1', name: 'Sleep', healthDirect: 0.5 }],
    }),
  );
  const loaded = loadCity()!;
  expect(loaded.version).toBe(7);
  // no new "General" — the existing borough is the re-home target
  expect(loaded.boroughs.filter((b) => b.districtId === 'd1')).toHaveLength(1);
  expect(loaded.habits[0].target).toEqual({ kind: 'borough', id: 'b-existing' });
  expect(loaded.landmarks[0].boroughId).toBe('b-existing');
  expect(loaded.neighborhoods.find((n) => n.id === 'nb1')!.boroughId).toBe('b-existing');
});

it('export then import round-trips deep-equal', () => {
  const s = createSeededCity();
  expect(importCity(exportCity(s))).toEqual(s);
});

it('importCity throws on invalid input', () => {
  expect(() => importCity('not json')).toThrow();
  expect(() => importCity('{"day":1}')).toThrow();
});

it('catchUpMissedDays advances day count', () => {
  const s = createSeededCity();
  expect(catchUpMissedDays(s, 3).day).toBe(s.day + 3);
  expect(catchUpMissedDays(s, 0).day).toBe(s.day);
});
