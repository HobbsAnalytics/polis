// Core data model for the Polis simulation engine (v2).
// This module has ZERO UI/render/DOM dependencies.

export type HabitKind = 'good' | 'bad';
/** Internal node addressing for the roll-up (a district is still a node). */
export type NodeKind = 'district' | 'borough' | 'landmark';
/** Where a habit may attach: a borough or a landmark — never a district directly. */
export type HabitTargetKind = 'borough' | 'landmark';

/** Where a habit attaches. `id` references a borough or landmark. */
export interface TargetRef {
  kind: HabitTargetKind;
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
  healthDirect: number; // 0..1, roll-up fallback only — no habit targets a district anymore
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
  boroughId: string; // required — landmarks always live under a borough
  name: string;
  condition: number;
  tier: number;
  tierProgress: number;
  createdDay: number;
}

/**
 * A single generic building. Each one carries its own health and decays/improves
 * individually, so a district reads as a patchwork of conditions. Belongs to a
 * borough when `boroughId` is set, otherwise directly to its district.
 */
export interface Neighborhood {
  id: string;
  districtId: string;
  boroughId: string | null;
  health: number; // 0..1, drifts individually
  createdDay: number;
}

/**
 * One day's activity + outcome. Appended once per advanced day. `netHealthChange`
 * is the summed delta across every node that day (drives week-box color); the
 * compact `snapshot` lets the History view re-render a past day read-only.
 */
export interface DayLog {
  day: number;
  dateISO: string;
  checkedIn: boolean;
  completedHabitIds: string[];
  loggedBadHabitIds: string[];
  netHealthChange: number;
  snapshot: DaySnapshot;
}

export interface DaySnapshot {
  neighborhoods: [string, number][]; // [id, health]
  landmarks: [string, number][]; // [id, condition]
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
  name: string;
  birthDateISO: string;
  lifespanYears: number;
  /** Set the first time `name` becomes non-empty; anchors the city's day counter. '' until then. */
  startDateISO: string;
}

/** A user-defined important life date, highlighted on the Life-in-Weeks grid. */
export interface Milestone {
  id: string;
  label: string;
  dateISO: string;
}

export interface CityState {
  version: number;
  day: number;
  settings: Settings;
  profile: Profile;
  milestones: Milestone[];
  districts: District[];
  boroughs: Borough[];
  landmarks: Landmark[];
  neighborhoods: Neighborhood[];
  habits: Habit[];
  log: DayLog[];
}

// ---- View model (the renderer seam) ----

export type ConditionLabel = 'pristine' | 'worn' | 'crumbling' | 'on fire' | 'ruin';

export interface GenericBuildingVM {
  id: string;
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
  generic: GenericBuildingVM[];
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
