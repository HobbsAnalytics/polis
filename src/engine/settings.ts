import type { Profile, Settings } from './types.ts';

export const CITY_VERSION = 8;

export const DEFAULT_PROFILE: Profile = {
  name: '',
  birthDateISO: '1988-11-01',
  lifespanYears: 75,
  startDateISO: '',
};

/**
 * Defaults tuned so one missed day is noise and ~3 neglected weeks clearly shows.
 * Habit health uses the cadence upkeep model (Task 4): completing deposits goodHabitGain,
 * maintained habits gain upkeepDailyGain, and overdue habits erode at overdueErosionBase
 * growing by overdueGrowthPerDay up to overdueGrowthCapDays. The legacy
 * missedHabitPenalty/missedCheckinPenalty are retained for save compatibility but are no
 * longer read by the habit math.
 */
export const DEFAULT_SETTINGS: Settings = {
  entropyPerDay: 0.01,
  goodHabitGain: 0.06,
  missedHabitPenalty: 0.03,
  missedCheckinPenalty: 0.008,
  badHabitPenalty: 0.12,
  tierUpThreshold: 0.85,
  daysToTier: 14,
  baseSpread: 12,
  maturityThreshold: 0.8,
  maturityGainPerDay: 0.2,
  removalCooldownDays: 2,
  upkeepDailyGain: 0.012,
  overdueErosionBase: 0.03,
  overdueGrowthPerDay: 0.15,
  overdueGrowthCapDays: 14,
};

/** Named organic features unlocked at district maturity milestones (sticky). */
export interface FeatureDef {
  id: string;
  at: number;
  name: string;
  emoji: string;
}

export const FEATURES: FeatureDef[] = [
  { id: 'fountain', at: 1, name: 'Fountain', emoji: '⛲' },
  { id: 'park', at: 3, name: 'Park', emoji: '🌳' },
  { id: 'library', at: 6, name: 'Library', emoji: '📚' },
  { id: 'market', at: 10, name: 'Market', emoji: '🏪' },
  { id: 'gardens', at: 15, name: 'Gardens', emoji: '🌸' },
  { id: 'cathedral', at: 22, name: 'Grand Hall', emoji: '🏛️' },
];
