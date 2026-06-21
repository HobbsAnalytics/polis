import type { CityState, District, Habit, Landmark, Settings } from './types.ts';
import { DEFAULT_SETTINGS } from './settings.ts';

export function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export interface CreateCityOpts {
  settings?: Settings;
  districts?: District[];
  landmarks?: Landmark[];
  habits?: Habit[];
}

export function createCity(opts: CreateCityOpts = {}): CityState {
  return {
    day: 0,
    settings: opts.settings ?? DEFAULT_SETTINGS,
    districts: opts.districts ?? [],
    landmarks: opts.landmarks ?? [],
    habits: opts.habits ?? [],
    history: [],
  };
}

/**
 * Daily evolution of a single 0..1 scalar (district health or landmark condition).
 * delta starts at -entropyPerDay (entropy is the resting state); good habits add,
 * missed good habits subtract (smaller if the user didn't even check in), logged
 * bad habits subtract the most.
 */
export function updateScalar(
  current: number,
  goods: Habit[],
  bads: Habit[],
  completed: Set<string>,
  logged: Set<string>,
  checkedIn: boolean,
  s: Settings,
): number {
  let delta = -s.entropyPerDay;
  for (const g of goods) {
    if (completed.has(g.id)) {
      delta += s.goodHabitGain;
    } else {
      delta -= checkedIn ? s.missedHabitPenalty : s.missedCheckinPenalty;
    }
  }
  for (const b of bads) {
    if (logged.has(b.id)) {
      delta -= s.badHabitPenalty;
    }
  }
  return clamp01(current + delta);
}

function habitsForDistrict(habits: Habit[], districtId: string, kind: Habit['kind']): Habit[] {
  return habits.filter(
    (h) => h.kind === kind && h.target.kind === 'district' && h.target.districtId === districtId,
  );
}

function habitsForLandmark(habits: Habit[], landmarkId: string, kind: Habit['kind']): Habit[] {
  return habits.filter(
    (h) => h.kind === kind && h.target.kind === 'landmark' && h.target.landmarkId === landmarkId,
  );
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

interface DayInput {
  completedHabitIds: string[];
  loggedBadHabitIds: string[];
  checkedIn: boolean;
}

function advanceDay(state: CityState, input: DayInput): CityState {
  const s = state.settings;
  const completed = new Set(input.completedHabitIds);
  const logged = new Set(input.loggedBadHabitIds);

  const districts = state.districts.map((d) => ({
    ...d,
    health: updateScalar(
      d.health,
      habitsForDistrict(state.habits, d.id, 'good'),
      habitsForDistrict(state.habits, d.id, 'bad'),
      completed,
      logged,
      input.checkedIn,
      s,
    ),
  }));

  const landmarks = state.landmarks.map((lm) => {
    const condition = updateScalar(
      lm.condition,
      habitsForLandmark(state.habits, lm.id, 'good'),
      habitsForLandmark(state.habits, lm.id, 'bad'),
      completed,
      logged,
      input.checkedIn,
      s,
    );
    return advanceLandmarkTier({ ...lm, condition }, s);
  });

  const day = state.day + 1;
  const history = [
    ...state.history,
    {
      day,
      checkedIn: input.checkedIn,
      completedHabitIds: [...input.completedHabitIds],
      loggedBadHabitIds: [...input.loggedBadHabitIds],
    },
  ];

  return { ...state, day, districts, landmarks, history };
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

export function addLandmark(
  state: CityState,
  opts: { districtId: string; name: string; condition?: number },
): { state: CityState; landmarkId: string } {
  const landmarkId = `landmark-${state.landmarks.length + 1}`;
  const landmark: Landmark = {
    id: landmarkId,
    districtId: opts.districtId,
    name: opts.name,
    condition: opts.condition ?? 0.5,
    tier: 0,
    tierProgress: 0,
    createdDay: state.day,
  };
  return { state: { ...state, landmarks: [...state.landmarks, landmark] }, landmarkId };
}
