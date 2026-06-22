import type {
  Borough,
  CityState,
  District,
  Habit,
  Landmark,
  Milestone,
  Profile,
  Settings,
} from './types.ts';
import { CITY_VERSION, DEFAULT_PROFILE, DEFAULT_SETTINGS, FEATURES } from './settings.ts';
import { districtHealth, habitsTargeting } from './rollup.ts';
import { dayDiffISO } from './dates.ts';

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
    habits: opts.habits ?? [],
    history: [],
  };
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
  checkedIn: boolean,
  s: Settings,
): number {
  let delta = -s.entropyPerDay;
  for (const h of habits) {
    if (h.kind === 'good') {
      if (completed.has(h.id)) {
        delta += s.goodHabitGain * h.weight;
      } else {
        delta -= (checkedIn ? s.missedHabitPenalty : s.missedCheckinPenalty) * h.weight;
      }
    } else if (logged.has(h.id)) {
      delta -= s.badHabitPenalty * h.weight;
    }
  }
  return clamp01(current + delta);
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
}

function advanceDay(state: CityState, input: DayInput): CityState {
  const s = state.settings;
  const completed = new Set(input.completedHabitIds);
  const logged = new Set(input.loggedBadHabitIds);

  const upd = (current: number, kind: 'district' | 'borough' | 'landmark', id: string) =>
    updateScalar(current, habitsTargeting(state.habits, kind, id), completed, logged, input.checkedIn, s);

  const landmarks = state.landmarks.map((lm) =>
    advanceLandmarkTier({ ...lm, condition: upd(lm.condition, 'landmark', lm.id) }, s),
  );
  const boroughs = state.boroughs.map((b) => ({ ...b, healthDirect: upd(b.healthDirect, 'borough', b.id) }));
  const districtsHD = state.districts.map((d) => ({ ...d, healthDirect: upd(d.healthDirect, 'district', d.id) }));

  // Intermediate state so roll-up sees the updated scalars.
  const next: CityState = {
    ...state,
    day: state.day + 1,
    landmarks,
    boroughs,
    districts: districtsHD,
    history: [
      ...state.history,
      {
        day: state.day + 1,
        checkedIn: input.checkedIn,
        completedHabitIds: [...input.completedHabitIds],
        loggedBadHabitIds: [...input.loggedBadHabitIds],
      },
    ],
  };

  next.districts = next.districts.map((d) => {
    const health = districtHealth(next, d);
    const maturity = health >= s.maturityThreshold ? d.maturity + s.maturityGainPerDay : d.maturity;
    return { ...d, maturity, features: unlockFeatures(d.features, maturity) };
  });

  return next;
}

export function applyCheckIn(
  state: CityState,
  input: { completedHabitIds: string[]; loggedBadHabitIds: string[] },
): CityState {
  return advanceDay(state, { ...input, checkedIn: true });
}

export function applyMissedDay(state: CityState): CityState {
  return advanceDay(state, { completedHabitIds: [], loggedBadHabitIds: [], checkedIn: false });
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

export function addDistrict(
  state: CityState,
  opts: { name: string; description?: string },
): { state: CityState; districtId: string } {
  const districtId = `district-${state.districts.length + 1}`;
  const district: District = {
    id: districtId,
    name: opts.name,
    description: opts.description ?? '',
    healthDirect: 0.5,
    maturity: 0,
    features: [],
  };
  return { state: { ...state, districts: [...state.districts, district] }, districtId };
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
  return { state: { ...state, boroughs: [...state.boroughs, borough] }, boroughId };
}

export function renameBorough(state: CityState, id: string, name: string): CityState {
  return {
    ...state,
    boroughs: state.boroughs.map((b) => (b.id === id ? { ...b, name } : b)),
  };
}

export function setProfile(state: CityState, profile: Profile): CityState {
  return { ...state, profile };
}

export function addMilestone(state: CityState, milestone: Milestone): CityState {
  return { ...state, milestones: [...state.milestones, milestone] };
}

export function removeMilestone(state: CityState, id: string): CityState {
  return { ...state, milestones: state.milestones.filter((m) => m.id !== id) };
}

export function addLandmark(
  state: CityState,
  opts: { districtId: string; boroughId?: string | null; name: string; condition?: number; attachHabitIds?: string[] },
): { state: CityState; landmarkId: string } {
  const landmarkId = `landmark-${state.landmarks.length + 1}`;
  const landmark: Landmark = {
    id: landmarkId,
    districtId: opts.districtId,
    boroughId: opts.boroughId ?? null,
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
 * Remove a landmark, re-homing any habits attached to it onto its parent
 * container (its borough if it had one, else its district) so no habit is
 * orphaned to a dead target.
 */
export function removeLandmark(state: CityState, id: string): CityState {
  const lm = state.landmarks.find((l) => l.id === id);
  if (!lm) return state;
  const target = lm.boroughId
    ? { kind: 'borough' as const, id: lm.boroughId }
    : { kind: 'district' as const, id: lm.districtId };
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
