import { it, expect } from '../testkit.ts';
import { dayDraft, setHabitLogged, openWindow, type DraftStore } from './drafts.ts';

it('dayDraft returns an empty draft for an unknown day', () => {
  const d = dayDraft({}, '2026-06-27');
  expect(d.completedHabitIds.length).toBe(0);
  expect(d.loggedBadHabitIds.length).toBe(0);
});

it('setHabitLogged adds a good habit and is idempotent', () => {
  let s: DraftStore = {};
  s = setHabitLogged(s, '2026-06-27', 'h1', 'good', true);
  s = setHabitLogged(s, '2026-06-27', 'h1', 'good', true); // idempotent
  expect(dayDraft(s, '2026-06-27').completedHabitIds).toEqual(['h1']);
});

it('setHabitLogged off removes the habit (undo)', () => {
  let s: DraftStore = setHabitLogged({}, '2026-06-27', 'h1', 'good', true);
  s = setHabitLogged(s, '2026-06-27', 'h1', 'good', false);
  expect(dayDraft(s, '2026-06-27').completedHabitIds.length).toBe(0);
});

it('setHabitLogged routes bad habits to loggedBadHabitIds', () => {
  const s = setHabitLogged({}, '2026-06-27', 'b1', 'bad', true);
  expect(dayDraft(s, '2026-06-27').loggedBadHabitIds).toEqual(['b1']);
});

it('openWindow yields one day when committed through yesterday', () => {
  const w = openWindow({}, '2026-06-27', '2026-06-26'); // lastResolved = yesterday
  expect(w.map((d) => d.dateISO)).toEqual(['2026-06-27']);
});

it('openWindow yields yesterday+today in steady state (committed through today-2)', () => {
  const w = openWindow({}, '2026-06-27', '2026-06-25');
  expect(w.map((d) => d.dateISO)).toEqual(['2026-06-26', '2026-06-27']);
});

it('openWindow carries each day\'s stored ids', () => {
  const s = setHabitLogged({}, '2026-06-27', 'h1', 'good', true);
  const w = openWindow(s, '2026-06-27', '2026-06-25');
  expect(w[1].completedHabitIds).toEqual(['h1']);
});
