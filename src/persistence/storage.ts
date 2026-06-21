import type { CityState } from '../engine/types.ts';
import { applyMissedDay } from '../engine/engine.ts';
import { CITY_VERSION, DEFAULT_PROFILE } from '../engine/settings.ts';

const STORAGE_KEY = 'polis.city';

export function saveCity(state: CityState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Returns the saved city, or null if absent / unparseable / a stale version. */
export function loadCity(): CityState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw == null) return null;
  try {
    const migrated = migrate(JSON.parse(raw) as Record<string, unknown>);
    if (!isCityState(migrated)) return null;
    return migrated.version === CITY_VERSION ? migrated : null;
  } catch {
    return null;
  }
}

/** Forward-migrate known older saves so they aren't lost on version bumps. */
function migrate(obj: Record<string, unknown>): unknown {
  if (obj.version === 2 && obj.profile == null) {
    return { ...obj, profile: DEFAULT_PROFILE, version: 3 };
  }
  return obj;
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
    typeof c.version === 'number' &&
    typeof c.day === 'number' &&
    typeof c.settings === 'object' &&
    c.settings !== null &&
    typeof c.profile === 'object' &&
    c.profile !== null &&
    Array.isArray(c.districts) &&
    Array.isArray(c.boroughs) &&
    Array.isArray(c.landmarks) &&
    Array.isArray(c.habits) &&
    Array.isArray(c.history)
  );
}
