import type {
  Borough,
  CityState,
  DaySnapshot,
  District,
  Habit,
  Landmark,
  Milestone,
  Neighborhood,
  Profile,
  Settings,
} from './types.ts';
import { CITY_VERSION, DEFAULT_PROFILE, DEFAULT_SETTINGS, FEATURES } from './settings.ts';
import { districtHealth, habitsTargeting } from './rollup.ts';
import {
  grownNeighborhoods,
  neighborhoodsForBorough,
  updateNeighborhood,
} from './neighborhoods.ts';
import { dayDiffISO } from './dates.ts';
import { habitStatus, cadenceEmphasis } from './cadence.ts';

export function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export interface CreateCityOpts {
  settings?: Settings;
  profile?: Profile;
  milestones?: Milestone[];
  districts?: District[];
  boroughs?: Borough[];
  landmarks?: Landmark[];
  neighborhoods?: Neighborhood[];
  habits?: Habit[];
}

export function createCity(opts: CreateCityOpts = {}): CityState {
  return {
    version: CITY_VERSION,
    day: 0,
    settings: opts.settings ?? DEFAULT_SETTINGS,
    profile: opts.profile ?? DEFAULT_PROFILE,
    milestones: opts.milestones ?? [],
    districts: opts.districts ?? [],
    boroughs: opts.boroughs ?? [],
    landmarks: opts.landmarks ?? [],
    neighborhoods: opts.neighborhoods ?? [],
    habits: opts.habits ?? [],
    log: [],
  };
}

/**
 * The habit-driven change for one node on a given day, excluding entropy.
 * Effects scale by habit weight and cadence emphasis. Shared by `updateScalar`
 * (district/borough/landmark scalars) and the neighborhood update (which adds
 * varied entropy). `checkedIn` is no longer used by habit math — the
 * maintained/overdue branches supersede the old missed-checkin distinction.
 */
export function habitDelta(
  habits: Habit[],
  completed: Set<string>,
  logged: Set<string>,
  s: Settings,
  todayISO: string,
): number {
  let delta = 0;
  for (const h of habits) {
    if (h.kind === 'good') {
      const e = cadenceEmphasis(h.cadence);
      if (completed.has(h.id)) {
        delta += s.goodHabitGain * h.weight * e;
      } else {
        const st = habitStatus({
          cadence: h.cadence,
          anchorISO: h.lastCompletedISO ?? h.createdAtISO,
          todayISO,
        });
        if (st.state === 'maintained') {
          delta += s.upkeepDailyGain * h.weight * e;
        } else if (st.state === 'dueToday') {
          delta -= s.overdueErosionBase * h.weight * e;
        } else {
          const growth = 1 + Math.min(st.daysOverdue, s.overdueGrowthCapDays) * s.overdueGrowthPerDay;
          delta -= s.overdueErosionBase * growth * h.weight * e;
        }
      }
    } else if (logged.has(h.id)) {
      delta -= s.badHabitPenalty * h.weight;
    }
  }
  return delta;
}

/**
 * Daily evolution of one 0..1 scalar, driven by the habits targeting that node.
 * Effects scale by habit weight. Entropy is the resting state.
 */
export function updateScalar(
  current: number,
  habits: Habit[],
  completed: Set<string>,
  logged: Set<string>,
  s: Settings,
  todayISO: string,
): number {
  return clamp01(current + habitDelta(habits, completed, logged, s, todayISO) - s.entropyPerDay);
}

function advanceLandmarkTier(lm: Landmark, s: Settings): Landmark {
  let tier = lm.tier;
  let tierProgress = lm.tierProgress;
  if (lm.condition >= s.tierUpThreshold) {
    tierProgress += 1;
    if (tierProgress >= s.daysToTier) {
      tier += 1;
      tierProgress = 0;
    }
  } else {
    tierProgress = Math.max(0, tierProgress - 1);
  }
  return { ...lm, tier, tierProgress };
}

function unlockFeatures(existing: string[], maturity: number): string[] {
  const unlocked = new Set(existing);
  for (const f of FEATURES) {
    if (maturity >= f.at) unlocked.add(f.id);
  }
  // Preserve FEATURES order for stable display.
  return FEATURES.filter((f) => unlocked.has(f.id)).map((f) => f.id);
}

interface DayInput {
  completedHabitIds: string[];
  loggedBadHabitIds: string[];
  checkedIn: boolean;
  /** Calendar date this day represents, for the activity log. */
  dateISO?: string;
}

function advanceDay(state: CityState, input: DayInput): CityState {
  const s = state.settings;
  const completed = new Set(input.completedHabitIds);
  const logged = new Set(input.loggedBadHabitIds);
  const today = input.dateISO ?? '';

  const upd = (current: number, kind: 'district' | 'borough' | 'landmark', id: string) =>
    updateScalar(current, habitsTargeting(state.habits, kind, id), completed, logged, s, today);
  // habit-driven delta (no entropy) for a container, memoized — neighborhoods reuse it.
  const deltaCache = new Map<string, number>();
  const containerDelta = (kind: 'district' | 'borough', id: string) => {
    const key = `${kind}:${id}`;
    let d = deltaCache.get(key);
    if (d === undefined) {
      d = habitDelta(habitsTargeting(state.habits, kind, id), completed, logged, s, today);
      deltaCache.set(key, d);
    }
    return d;
  };

  const landmarks = state.landmarks.map((lm) =>
    advanceLandmarkTier({ ...lm, condition: upd(lm.condition, 'landmark', lm.id) }, s),
  );
  const boroughs = state.boroughs.map((b) => ({ ...b, healthDirect: upd(b.healthDirect, 'borough', b.id) }));
  // Districts take no direct habits anymore: `healthDirect` is a frozen roll-up
  // fallback and is left untouched here.

  // Each building drifts on its own. No habit targets a district, so a building's
  // habit-driven delta comes solely from the borough it belongs to (if any).
  const neighborhoods = state.neighborhoods.map((n) => {
    const delta = n.boroughId ? containerDelta('borough', n.boroughId) : 0;
    return { ...n, health: updateNeighborhood(n, delta, s) };
  });

  // Net change across the city's primary carriers — drives the Life week-box color.
  const netHealthChange =
    neighborhoods.reduce((acc, n, i) => acc + (n.health - state.neighborhoods[i].health), 0) +
    landmarks.reduce((acc, lm, i) => acc + (lm.condition - state.landmarks[i].condition), 0);

  // Intermediate state so roll-up sees the updated scalars.
  const next: CityState = {
    ...state,
    day: state.day + 1,
    landmarks,
    boroughs,
    neighborhoods,
    districts: state.districts,
  };

  next.districts = next.districts.map((d) => {
    const health = districtHealth(next, d);
    const maturity = health >= s.maturityThreshold ? d.maturity + s.maturityGainPerDay : d.maturity;
    return { ...d, maturity, features: unlockFeatures(d.features, maturity) };
  });

  // Legacy growth: matured districts accrue new (never-vanishing) buildings.
  const grown = grownNeighborhoods(
    next.districts,
    next.neighborhoods,
    (id) => next.districts.find((d) => d.id === id)?.healthDirect ?? 0.5,
    next.day,
  );
  if (grown.length > 0) next.neighborhoods = [...next.neighborhoods, ...grown];

  next.log = [
    ...state.log,
    {
      day: next.day,
      dateISO: input.dateISO ?? '',
      checkedIn: input.checkedIn,
      completedHabitIds: [...input.completedHabitIds],
      loggedBadHabitIds: [...input.loggedBadHabitIds],
      netHealthChange,
      snapshot: snapshotOf(next),
    },
  ];

  return next;
}

function snapshotOf(state: CityState): DaySnapshot {
  return {
    neighborhoods: state.neighborhoods.map((n) => [n.id, round3(n.health)]),
    landmarks: state.landmarks.map((lm) => [lm.id, round3(lm.condition)]),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function applyCheckIn(
  state: CityState,
  input: { completedHabitIds: string[]; loggedBadHabitIds: string[]; dateISO?: string },
): CityState {
  return advanceDay(state, { ...input, checkedIn: true });
}

export function applyMissedDay(state: CityState, dateISO?: string): CityState {
  return advanceDay(state, { completedHabitIds: [], loggedBadHabitIds: [], checkedIn: false, dateISO });
}

export function addHabit(state: CityState, habit: Habit): CityState {
  return { ...state, habits: [...state.habits, habit] };
}

/** Edit a habit's name and/or weight (weight floored at 1). Other fields untouched. */
export function updateHabit(
  state: CityState,
  habitId: string,
  fields: { name?: string; weight?: number },
): CityState {
  return {
    ...state,
    habits: state.habits.map((h) =>
      h.id === habitId
        ? {
            ...h,
            name: fields.name ?? h.name,
            weight: fields.weight != null ? Math.max(1, fields.weight) : h.weight,
          }
        : h,
    ),
  };
}

// ---- District / Borough authoring (add + rename only; no removal) ----

/**
 * Add a district plus its mandatory "General" starter borough (every district
 * has ≥1 borough). The district seeds no direct buildings; the General borough
 * carries them, so every building lives under a borough — mirroring the v7
 * migration's end state.
 */
export function addDistrict(
  state: CityState,
  opts: { name: string; description?: string },
): { state: CityState; districtId: string; boroughId: string } {
  const districtId = `district-${state.districts.length + 1}`;
  const district: District = {
    id: districtId,
    name: opts.name,
    description: opts.description ?? '',
    healthDirect: 0.5,
    maturity: 0,
    features: [],
  };
  const withDistrict: CityState = { ...state, districts: [...state.districts, district] };
  const { state: withBorough, boroughId } = addBorough(withDistrict, { districtId, name: 'General' });
  return { state: withBorough, districtId, boroughId };
}

export function renameDistrict(
  state: CityState,
  id: string,
  fields: { name?: string; description?: string },
): CityState {
  return {
    ...state,
    districts: state.districts.map((d) =>
      d.id === id
        ? { ...d, name: fields.name ?? d.name, description: fields.description ?? d.description }
        : d,
    ),
  };
}

export function addBorough(
  state: CityState,
  opts: { districtId: string; name: string },
): { state: CityState; boroughId: string } {
  const boroughId = `borough-${state.boroughs.length + 1}`;
  const borough: Borough = {
    id: boroughId,
    districtId: opts.districtId,
    name: opts.name,
    healthDirect: 0.5,
  };
  const neighborhoods = neighborhoodsForBorough(borough, state.settings.baseSpread, state.day);
  return {
    state: {
      ...state,
      boroughs: [...state.boroughs, borough],
      neighborhoods: [...state.neighborhoods, ...neighborhoods],
    },
    boroughId,
  };
}

export function renameBorough(state: CityState, id: string, name: string): CityState {
  return {
    ...state,
    boroughs: state.boroughs.map((b) => (b.id === id ? { ...b, name } : b)),
  };
}

/**
 * Update the profile. The first time a name is set, `todayISO` anchors the city's
 * day counter (`startDateISO`) — the day you name your city is Day 1.
 */
export function setProfile(state: CityState, profile: Profile, todayISO?: string): CityState {
  const anchored =
    profile.name.trim() !== '' && !profile.startDateISO && todayISO
      ? { ...profile, startDateISO: todayISO }
      : profile;
  return { ...state, profile: anchored };
}

/** Days since the city was named (Day 1 = the day you set your name). 0 until named. */
export function cityDay(profile: Profile, todayISO: string): number {
  if (!profile.startDateISO) return 0;
  return Math.max(0, dayDiffISO(profile.startDateISO, todayISO)) + 1;
}

export function addMilestone(state: CityState, milestone: Milestone): CityState {
  return { ...state, milestones: [...state.milestones, milestone] };
}

export function removeMilestone(state: CityState, id: string): CityState {
  return { ...state, milestones: state.milestones.filter((m) => m.id !== id) };
}

export function addLandmark(
  state: CityState,
  opts: { districtId: string; boroughId: string; name: string; condition?: number; attachHabitIds?: string[] },
): { state: CityState; landmarkId: string } {
  const landmarkId = `landmark-${state.landmarks.length + 1}`;
  const landmark: Landmark = {
    id: landmarkId,
    districtId: opts.districtId,
    boroughId: opts.boroughId,
    name: opts.name,
    condition: opts.condition ?? 0.5,
    tier: 0,
    tierProgress: 0,
    createdDay: state.day,
  };
  const attach = new Set(opts.attachHabitIds ?? []);
  const habits = state.habits.map((h) =>
    attach.has(h.id) ? { ...h, target: { kind: 'landmark' as const, id: landmarkId } } : h,
  );
  return { state: { ...state, habits, landmarks: [...state.landmarks, landmark] }, landmarkId };
}

export function renameLandmark(state: CityState, id: string, name: string): CityState {
  return {
    ...state,
    landmarks: state.landmarks.map((lm) => (lm.id === id ? { ...lm, name } : lm)),
  };
}

/**
 * Remove a landmark, re-homing any habits attached to it onto its borough
 * (a landmark always has one) so no habit is orphaned to a dead target.
 */
export function removeLandmark(state: CityState, id: string): CityState {
  const lm = state.landmarks.find((l) => l.id === id);
  if (!lm) return state;
  const target = { kind: 'borough' as const, id: lm.boroughId };
  return {
    ...state,
    landmarks: state.landmarks.filter((l) => l.id !== id),
    habits: state.habits.map((h) =>
      h.target.kind === 'landmark' && h.target.id === id ? { ...h, target } : h,
    ),
  };
}

// ---- Removal cooldown (real calendar days; day math passed in from the UI) ----

export function requestHabitRemoval(state: CityState, habitId: string, todayISO: string): CityState {
  return {
    ...state,
    habits: state.habits.map((h) => (h.id === habitId ? { ...h, pendingRemovalSinceISO: todayISO } : h)),
  };
}

export function cancelHabitRemoval(state: CityState, habitId: string): CityState {
  return {
    ...state,
    habits: state.habits.map((h) => {
      if (h.id !== habitId) return h;
      const { pendingRemovalSinceISO: _drop, ...rest } = h;
      return rest;
    }),
  };
}

/** Removes the habit only if the cooldown has elapsed; otherwise returns state unchanged. */
export function confirmHabitRemoval(state: CityState, habitId: string, todayISO: string): CityState {
  const h = state.habits.find((x) => x.id === habitId);
  if (!h || h.pendingRemovalSinceISO == null) return state;
  if (dayDiffISO(h.pendingRemovalSinceISO, todayISO) < state.settings.removalCooldownDays) return state;
  return { ...state, habits: state.habits.filter((x) => x.id !== habitId) };
}
