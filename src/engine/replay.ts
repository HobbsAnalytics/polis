import type { CityState } from './types.ts';
import { applyCheckIn } from './engine.ts';

/** One editable day's logged habits, stamped to a calendar date. */
export interface DraftInput {
  dateISO: string;
  completedHabitIds: string[];
  loggedBadHabitIds: string[];
}

/**
 * Fold draft days onto a committed base in chronological order, reusing the
 * engine's per-day math. Pure and deterministic (the engine has no RNG), so
 * replaying the same drafts on the same base always yields an identical city.
 */
export function replayDrafts(base: CityState, drafts: DraftInput[]): CityState {
  return drafts.reduce(
    (s, d) =>
      applyCheckIn(s, {
        completedHabitIds: d.completedHabitIds,
        loggedBadHabitIds: d.loggedBadHabitIds,
        dateISO: d.dateISO,
      }),
    base,
  );
}
