import type { Borough, CityState, DayLog, District, Habit, Landmark, Neighborhood } from '../engine/types.ts';
import { applyMissedDay } from '../engine/engine.ts';
import { seedNeighborhoods } from '../engine/neighborhoods.ts';
import { createSeededCity } from '../engine/seed.ts';
import { dayDiffISO, addDaysISO } from '../engine/dates.ts';
import { CITY_VERSION, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../engine/settings.ts';

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
  if (o.version === 5) {
    // v6: individual buildings, a calendar anchor, and a richer activity log.
    const profile = (o.profile as Record<string, unknown> | undefined) ?? DEFAULT_PROFILE;
    const baseSpread =
      ((o.settings as Record<string, unknown> | undefined)?.baseSpread as number | undefined) ??
      DEFAULT_SETTINGS.baseSpread;
    const districts = (o.districts as District[] | undefined) ?? [];
    const boroughs = (o.boroughs as Borough[] | undefined) ?? [];
    // Anchor day to the original creation date if we can infer it, else leave unset.
    const startDateISO =
      typeof profile.startDateISO === 'string' && profile.startDateISO
        ? profile.startDateISO
        : '';
    o = {
      ...o,
      profile: { ...DEFAULT_PROFILE, ...profile, startDateISO },
      neighborhoods: o.neighborhoods ?? seedNeighborhoods(districts, boroughs, baseSpread),
      log: migrateHistoryToLog(o.history),
      version: 6,
    };
    delete (o as Record<string, unknown>).history;
  }
  if (o.version === 6) {
    // v7: boroughs become mandatory and habits/landmarks live under a borough.
    // Back-fill a "General" borough for any borough-less district and re-home
    // everything parented directly to a district into its first borough.
    o = migrateV6toV7(o);
  }
  if (o.version === 7) {
    // v8: good habits gain cadence ('daily' default) and lastCompletedISO;
    // settings tunables are backfilled so the upkeep engine never sees NaN.
    o = migrateV7toV8(o);
  }
  return o;
}

/**
 * v6 → v7: every district gets ≥1 borough; nothing that was parented directly to
 * a district stays there. Deletes nothing — re-parents one level down, keeping
 * all ids, health, and history. District-direct habits/landmarks/neighborhoods
 * move into the district's first borough ("General", created when absent).
 */
function migrateV6toV7(o: Record<string, unknown>): Record<string, unknown> {
  const districts = (o.districts as District[] | undefined) ?? [];
  const boroughs = [...((o.boroughs as Borough[] | undefined) ?? [])];
  const habits = [...((o.habits as Habit[] | undefined) ?? [])];
  const landmarks = [...((o.landmarks as Landmark[] | undefined) ?? [])];
  const neighborhoods = [...((o.neighborhoods as Neighborhood[] | undefined) ?? [])];

  // The borough each district's direct items re-home into (first existing, else a new General).
  const homeBoroughId = new Map<string, string>();
  for (const d of districts) {
    const existing = boroughs.find((b) => b.districtId === d.id);
    if (existing) {
      homeBoroughId.set(d.id, existing.id);
    } else {
      const general: Borough = { id: `borough-${d.id}-general`, districtId: d.id, name: 'General', healthDirect: 0.5 };
      boroughs.push(general);
      homeBoroughId.set(d.id, general.id);
    }
  }

  const rehome = (districtId: string) => homeBoroughId.get(districtId)!;

  return {
    ...o,
    boroughs,
    habits: habits.map((h) =>
      (h.target.kind as string) === 'district'
        ? { ...h, target: { kind: 'borough' as const, id: rehome(h.target.id) } }
        : h,
    ),
    landmarks: landmarks.map((lm) =>
      (lm.boroughId as string | null) == null ? { ...lm, boroughId: rehome(lm.districtId) } : lm,
    ),
    neighborhoods: neighborhoods.map((n) =>
      n.boroughId == null ? { ...n, boroughId: rehome(n.districtId) } : n,
    ),
    version: 7,
  };
}

/**
 * v7 → v8: good habits gain `cadence` ('daily' default) and `lastCompletedISO`
 * (most recent log dateISO where the habit was completed, else createdAtISO).
 * Bad habits are left unchanged — cadence is a good-habit-only concept.
 * Settings tunables added in Task 3 are backfilled from DEFAULT_SETTINGS so the
 * upkeep engine never reads undefined and produces NaN.
 */
function migrateV7toV8(o: Record<string, unknown>): Record<string, unknown> {
  const habits = Array.isArray(o.habits) ? (o.habits as Record<string, unknown>[]) : [];
  const log = Array.isArray(o.log) ? (o.log as Record<string, unknown>[]) : [];
  const migratedHabits = habits.map((h) => {
    if (h.kind !== 'good') return h; // bad habits have no cadence (good-habit-only constraint)
    let last: string | undefined;
    for (const entry of log) {
      const ids = Array.isArray(entry.completedHabitIds) ? (entry.completedHabitIds as string[]) : [];
      const dISO = typeof entry.dateISO === 'string' ? entry.dateISO : '';
      if (ids.includes(h.id as string) && dISO) last = last && last > dISO ? last : dISO;
    }
    return {
      ...h,
      cadence: h.cadence ?? 'daily',
      lastCompletedISO: h.lastCompletedISO ?? last ?? h.createdAtISO,
    };
  });
  const settings = { ...DEFAULT_SETTINGS, ...((o.settings as Record<string, unknown>) ?? {}) };
  return { ...o, habits: migratedHabits, settings, version: 8 };
}

/** Old saves stored a thin per-day `history`; carry it forward into `log` shape. */
function migrateHistoryToLog(history: unknown): DayLog[] {
  if (!Array.isArray(history)) return [];
  return history.map((h: Record<string, unknown>) => ({
    day: (h.day as number) ?? 0,
    dateISO: '',
    checkedIn: (h.checkedIn as boolean) ?? false,
    completedHabitIds: (h.completedHabitIds as string[]) ?? [],
    loggedBadHabitIds: (h.loggedBadHabitIds as string[]) ?? [],
    netHealthChange: 0,
    snapshot: { neighborhoods: [], landmarks: [] },
  }));
}

export function exportCity(state: CityState): string {
  return JSON.stringify(state, null, 2);
}

export function importCity(json: string): CityState {
  return parseCity(json);
}

/**
 * Apply `elapsedDays` missed-day ticks (entropy + missed-checkin). 0 ⇒ unchanged.
 * `firstDateISO`, when given, is the calendar date of the first missed day so the
 * activity log carries real dates.
 */
export function catchUpMissedDays(state: CityState, elapsedDays: number, firstDateISO?: string): CityState {
  let s = state;
  for (let i = 0; i < elapsedDays; i++) {
    s = applyMissedDay(s, firstDateISO ? addDaysISO(firstDateISO, i) : undefined);
  }
  return s;
}

export function anchorStartDate(state: CityState, todayISO: string, lastResolved: string | null): CityState {
  if (state.profile.startDateISO) return state;
  const dated = state.log.map((d) => d.dateISO).filter(Boolean).sort();
  const start = dated[0] ?? lastResolved ?? todayISO;
  return { ...state, profile: { ...state.profile, startDateISO: start } };
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

  const anchored = anchorStartDate(s, todayISO, lastResolved);
  if (anchored !== s) { s = anchored; saveCity(s); }

  if (lastResolved == null) {
    localStorage.setItem(LAST_RESOLVED_KEY, todayISO);
  } else {
    const missed = Math.max(0, dayDiffISO(lastResolved, todayISO) - 2); // grace: hold yesterday open
    if (missed > 0) {
      s = catchUpMissedDays(s, missed, addDaysISO(lastResolved, 1));
      localStorage.setItem(LAST_RESOLVED_KEY, addDaysISO(todayISO, -2));
      saveCity(s);
    }
  }
  return s;
}

/** The day of the user's last check-in (YYYY-MM-DD), or null if never. */
export function getLastCheckIn(): string | null {
  return localStorage.getItem(LAST_CHECKIN_KEY);
}

/** Mark the given day as both checked-in and resolved. */
export function recordCheckIn(dateISO: string): void {
  localStorage.setItem(LAST_RESOLVED_KEY, dateISO);
  localStorage.setItem(LAST_CHECKIN_KEY, dateISO);
}

/** True iff yesterday (today−1) is unresolved and today is not yet logged. */
export function canLogYesterday(todayISO: string): boolean {
  const lastResolved = localStorage.getItem(LAST_RESOLVED_KEY);
  const lastCheckIn = localStorage.getItem(LAST_CHECKIN_KEY);
  const yesterdayOpen = lastResolved == null || dayDiffISO(lastResolved, todayISO) >= 2;
  return yesterdayOpen && lastCheckIn !== todayISO;
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
    Array.isArray(c.neighborhoods) &&
    Array.isArray(c.habits) &&
    Array.isArray(c.log)
  );
}
