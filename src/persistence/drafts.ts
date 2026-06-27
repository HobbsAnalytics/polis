import type { DraftInput } from '../engine/replay.ts';
import { addDaysISO, dayDiffISO } from '../engine/dates.ts';

export type DraftDay = { completedHabitIds: string[]; loggedBadHabitIds: string[] };
export type DraftStore = Record<string, DraftDay>;

const DRAFTS_KEY = 'polis.drafts';

export function dayDraft(store: DraftStore, dateISO: string): DraftDay {
  return store[dateISO] ?? { completedHabitIds: [], loggedBadHabitIds: [] };
}

/** Toggle a habit's logged state for a day. `on` adds (idempotent); false removes. Returns a new store. */
export function setHabitLogged(
  store: DraftStore,
  dateISO: string,
  habitId: string,
  kind: 'good' | 'bad',
  on: boolean,
): DraftStore {
  const d = dayDraft(store, dateISO);
  const field = kind === 'good' ? 'completedHabitIds' : 'loggedBadHabitIds';
  const ids = new Set(d[field]);
  if (on) ids.add(habitId);
  else ids.delete(habitId);
  return { ...store, [dateISO]: { ...d, [field]: [...ids] } };
}

/**
 * The editable open window as ordered DraftInputs: every calendar day strictly
 * after `lastResolved` up to and including `todayISO`. Steady state is two days
 * (yesterday + today); the day after a fresh/migrated load it is one (today).
 */
export function openWindow(store: DraftStore, todayISO: string, lastResolved: string): DraftInput[] {
  const out: DraftInput[] = [];
  let d = addDaysISO(lastResolved, 1);
  while (dayDiffISO(d, todayISO) >= 0) {
    out.push({ dateISO: d, ...dayDraft(store, d) });
    d = addDaysISO(d, 1);
  }
  return out;
}

export function loadDrafts(): DraftStore {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '{}') as DraftStore;
  } catch {
    return {};
  }
}

export function saveDrafts(store: DraftStore): void {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(store));
}
