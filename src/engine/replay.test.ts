import { it, expect } from '../testkit.ts';
import { createSeededCity } from './seed.ts';
import { replayDrafts, type DraftInput } from './replay.ts';

it('replayDrafts with no drafts returns the base unchanged', () => {
  const base = createSeededCity();
  expect(replayDrafts(base, [])).toBe(base);
});

it('replayDrafts folds one draft day = one advanced day', () => {
  const base = createSeededCity();
  const drafts: DraftInput[] = [{ dateISO: '2026-06-27', completedHabitIds: [], loggedBadHabitIds: [] }];
  expect(replayDrafts(base, drafts).day).toBe(base.day + 1);
});

it('replayDrafts is deterministic — same inputs yield identical state', () => {
  const base = createSeededCity();
  const drafts: DraftInput[] = [
    { dateISO: '2026-06-26', completedHabitIds: [], loggedBadHabitIds: [] },
    { dateISO: '2026-06-27', completedHabitIds: [], loggedBadHabitIds: [] },
  ];
  const a = replayDrafts(base, drafts);
  const b = replayDrafts(base, drafts);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});
