import type { CityState } from '../engine/types.ts';
import { applyMissedDay } from '../engine/engine.ts';
import { createSeededCity } from '../engine/seed.ts';
import { dayDiffISO, addDaysISO } from '../engine/dates.ts';
import { CITY_VERSION, DEFAULT_PROFILE } from '../engine/settings.ts';

const STORAGE_KEY = 'polis.city';
// Day-resolution bookkeeping (owned here, kept separate from the city blob).
const LAST_RESOLVED_KEY = 'polis.lastResolved';
const LAST_CHECKIN_KEY = 'polis.lastCheckIn';

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
  let o = obj;
  if (o.version === 2 && o.profile == null) {
    o = { ...o, profile: DEFAULT_PROFILE, version: 3 };
  }
  if (o.version === 3 && o.milestones == null) {
    o = { ...o, milestones: [], version: 4 };
  }
  if (o.version === 4) {
    const profile = (o.profile as Record<string, unknown> | undefined) ?? DEFAULT_PROFILE;
    o = { ...o, profile: { name: '', ...profile }, version: 5 };
  }
  return o;
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

/**
 * Load the saved city (or seed a fresh one) and resolve any whole days missed
 * since the last resolution — entropy/missed-check-in for each, minus today
 * (today is still open to check in). Persists both the advanced city and the
 * resolution marker. The one entry point the UI needs at startup.
 */
export function loadResolvedCity(todayISO: string): CityState {
  let s = loadCity() ?? createSeededCity();
  const lastResolved = localStorage.getItem(LAST_RESOLVED_KEY);
  if (lastResolved == null) {
    localStorage.setItem(LAST_RESOLVED_KEY, todayISO);
  } else {
    const missed = Math.max(0, dayDiffISO(lastResolved, todayISO) - 1);
    if (missed > 0) {
      s = catchUpMissedDays(s, missed);
      localStorage.setItem(LAST_RESOLVED_KEY, addDaysISO(todayISO, -1));
      saveCity(s);
    }
  }
  return s;
}

/** The day of the user's last check-in (YYYY-MM-DD), or null if never. */
export function getLastCheckIn(): string | null {
  return localStorage.getItem(LAST_CHECKIN_KEY);
}

/** Mark today as both checked-in and resolved. */
export function recordCheckIn(todayISO: string): void {
  localStorage.setItem(LAST_RESOLVED_KEY, todayISO);
  localStorage.setItem(LAST_CHECKIN_KEY, todayISO);
}

/** Reset resolution bookkeeping for a fresh seed (no check-in yet, resolved today). */
export function resetResolution(todayISO: string): void {
  localStorage.removeItem(LAST_CHECKIN_KEY);
  localStorage.setItem(LAST_RESOLVED_KEY, todayISO);
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
    Array.isArray(c.milestones) &&
    Array.isArray(c.districts) &&
    Array.isArray(c.boroughs) &&
    Array.isArray(c.landmarks) &&
    Array.isArray(c.habits) &&
    Array.isArray(c.history)
  );
}
