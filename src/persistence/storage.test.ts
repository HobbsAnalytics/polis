import { it, expect, beforeEach } from '../testkit.ts';
import { saveCity, loadCity, exportCity, importCity, catchUpMissedDays } from './storage.ts';
import { createSeededCity } from '../engine/seed.ts';

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
  expect(loaded?.version).toBe(5);
  expect(loaded?.profile.lifespanYears).toBe(75);
  expect(loaded?.profile.name).toBe('');
  expect(loaded?.milestones).toEqual([]);
});

it('migrates a v3 save (no milestones) up to current', () => {
  const s = createSeededCity();
  const { milestones: _m, ...old } = s;
  saveCity({ ...old, version: 3 } as unknown as typeof s);
  const loaded = loadCity();
  expect(loaded?.version).toBe(5);
  expect(loaded?.milestones).toEqual([]);
});

it('migrates a v4 save (no profile.name) up to current with an empty name', () => {
  const s = createSeededCity();
  const { name: _n, ...profileNoName } = s.profile;
  saveCity({ ...s, profile: profileNoName, version: 4 } as unknown as typeof s);
  const loaded = loadCity();
  expect(loaded?.version).toBe(5);
  expect(loaded?.profile.name).toBe('');
  expect(loaded?.profile.birthDateISO).toBe(s.profile.birthDateISO);
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
