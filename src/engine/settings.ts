import type { Settings } from './types.ts';

/**
 * Defaults tuned so that one missed day is noise and ~3 neglected weeks clearly
 * shows. Neglect gradient: missedCheckinPenalty < missedHabitPenalty < badHabitPenalty.
 */
export const DEFAULT_SETTINGS: Settings = {
  windowDays: 14,
  entropyPerDay: 0.01,
  goodHabitGain: 0.06,
  missedHabitPenalty: 0.03,
  missedCheckinPenalty: 0.008,
  badHabitPenalty: 0.12,
  tierUpThreshold: 0.85,
  daysToTier: 14,
  maxGenericBuildings: 12,
};
