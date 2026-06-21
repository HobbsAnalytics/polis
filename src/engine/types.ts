// Core data model for the Polis simulation engine (v2).
// This module has ZERO UI/render/DOM dependencies.

export type HabitKind = 'good' | 'bad';
export type NodeKind = 'district' | 'borough' | 'landmark';

/** Where a habit attaches. `id` references a district, borough, or landmark. */
export interface TargetRef {
  kind: NodeKind;
  id: string;
}

export interface Habit {
  id: string;
  name: string;
  kind: HabitKind;
  weight: number;
  target: TargetRef;
  createdAtISO: string;
  /** Set (to an ISO date) when the user requests removal; cooldown gates deletion. */
  pendingRemovalSinceISO?: string;
}

/** A wellbeing domain — a neighborhood. */
export interface District {
  id: string;
  name: string;
  description: string;
  healthDirect: number; // 0..1, from habits targeting the district directly
  maturity: number; // >=0, unbounded, sticky
  features: string[]; // unlocked feature ids, sticky
}

/** Optional sub-category within a district. */
export interface Borough {
  id: string;
  districtId: string;
  name: string;
  healthDirect: number; // 0..1, from habits targeting the borough directly
}

/** A specific, committed goal. `tier` is sticky and never decreases. */
export interface Landmark {
  id: string;
  districtId: string;
  boroughId: string | null;
  name: string;
  condition: number;
  tier: number;
  tierProgress: number;
  createdDay: number;
}

export interface DayRecord {
  day: number;
  checkedIn: boolean;
  completedHabitIds: string[];
  loggedBadHabitIds: string[];
}

export interface Settings {
  entropyPerDay: number;
  goodHabitGain: number;
  missedHabitPenalty: number;
  missedCheckinPenalty: number;
  badHabitPenalty: number;
  tierUpThreshold: number;
  daysToTier: number;
  baseSpread: number; // live-building scaling factor
  maturityThreshold: number; // district health at/above which maturity accrues
  maturityGainPerDay: number;
  removalCooldownDays: number;
}

export interface Profile {
  birthDateISO: string;
  lifespanYears: number;
}

export interface CityState {
  version: number;
  day: number;
  settings: Settings;
  profile: Profile;
  districts: District[];
  boroughs: Borough[];
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

export interface FeatureVM {
  id: string;
  name: string;
  emoji: string;
}

export interface LandmarkVM {
  id: string;
  name: string;
  condition: number;
  label: ConditionLabel;
  tier: number;
}

export interface BoroughVM {
  id: string;
  name: string;
  health: number;
  label: ConditionLabel;
  landmarks: LandmarkVM[];
}

export interface DistrictVM {
  id: string;
  name: string;
  description: string;
  health: number;
  label: ConditionLabel;
  maturity: number;
  generic: GenericBuildingVM[];
  features: FeatureVM[];
  boroughs: BoroughVM[];
  landmarks: LandmarkVM[]; // directly attached (no borough)
}

export interface CityViewModel {
  day: number;
  districts: DistrictVM[];
}
