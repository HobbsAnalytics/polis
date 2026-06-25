import type { Profile, Settings } from './types.ts';

export const CITY_VERSION = 7;

export const DEFAULT_PROFILE: Profile = {
  name: '',
  birthDateISO: '1988-11-01',
  lifespanYears: 75,
  startDateISO: '',
};

/**
 * Defaults tuned so one missed day is noise and ~3 neglected weeks clearly shows.
 * Neglect gradient: missedCheckinPenalty < missedHabitPenalty < badHabitPenalty.
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
