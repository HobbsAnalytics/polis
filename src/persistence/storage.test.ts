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

it('export then import round-trips deep-equal', () => {
  const s = createSeededCity();
  const json = exportCity(s);
  expect(importCity(json)).toEqual(s);
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
