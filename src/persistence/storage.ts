import type { CityState } from '../engine/types.ts';
import { applyMissedDay } from '../engine/engine.ts';

const STORAGE_KEY = 'polis.city';

export function saveCity(state: CityState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadCity(): CityState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null) return null;
  try {
    return parseCity(raw);
  } catch {
    return null;
  }
}

export function exportCity(state: CityState): string {
  return JSON.stringify(state, null, 2);
}

export function importCity(json: string): CityState {
  return parseCity(json);
}

/** Apply `elapsedDays` missed-day ticks (entropy + missed-checkin). 0 ⇒ unchanged. */
export function catchUpMissedDays(state: CityState, elapsedDays: number): CityState {
  let s = state;
  for (let i = 0; i < elapsedDays; i++) s = applyMissedDay(s);
  return s;
}

function parseCity(json: string): CityState {
  const obj = JSON.parse(json) as unknown;
  if (!isCityState(obj)) {
    throw new Error('Invalid Polis city data');
  }
  return obj;
}

function isCityState(obj: unknown): obj is CityState {
  if (typeof obj !== 'object' || obj === null) return false;
  const c = obj as Record<string, unknown>;
  return (
    typeof c.day === 'number' &&
    typeof c.settings === 'object' &&
    c.settings !== null &&
    Array.isArray(c.districts) &&
    Array.isArray(c.landmarks) &&
    Array.isArray(c.habits) &&
    Array.isArray(c.history)
  );
}
