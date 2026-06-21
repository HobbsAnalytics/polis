// Core data model for the Polis simulation engine.
// This module has ZERO UI/render/DOM dependencies.

export type HabitKind = 'good' | 'bad';

export type TargetRef =
  | { kind: 'district'; districtId: string }
  | { kind: 'landmark'; landmarkId: string };

export interface Habit {
  id: string;
  name: string;
  kind: HabitKind;
  target: TargetRef;
}

/** A wellbeing domain — a neighborhood. `health` is 0..1. */
export interface District {
  id: string;
  name: string;
  description: string;
  health: number;
}

/** A specific, committed goal. `condition` is 0..1; `tier` is sticky and never decreases. */
export interface Landmark {
  id: string;
  districtId: string;
  name: string;
  condition: number;
  tier: number;
  tierProgress: number;
  createdDay: number;
}

/** One day's log. For a missed day, checkedIn is false and the id arrays are empty. */
export interface DayRecord {
  day: number;
  checkedIn: boolean;
  completedHabitIds: string[];
  loggedBadHabitIds: string[];
}

/** Tunable simulation constants. "Weeks not days": small per-day movement. */
export interface Settings {
  windowDays: number;
  entropyPerDay: number;
  goodHabitGain: number;
  missedHabitPenalty: number;
  missedCheckinPenalty: number;
  badHabitPenalty: number;
  tierUpThreshold: number;
  daysToTier: number;
  maxGenericBuildings: number;
}

export interface CityState {
  day: number;
  settings: Settings;
  districts: District[];
  landmarks: Landmark[];
  habits: Habit[];
  history: DayRecord[];
}

// ---- View model (the renderer seam) ----

export type ConditionLabel = 'pristine' | 'worn' | 'crumbling' | 'on fire' | 'ruin';

export interface GenericBuildingVM {
  condition: number;
  label: ConditionLabel;
}

export interface LandmarkVM {
  id: string;
  name: string;
  condition: number;
  label: ConditionLabel;
  tier: number;
}

export interface DistrictVM {
  id: string;
  name: string;
  description: string;
  health: number;
  generic: GenericBuildingVM[];
  landmarks: LandmarkVM[];
}

export interface CityViewModel {
  day: number;
  districts: DistrictVM[];
}
