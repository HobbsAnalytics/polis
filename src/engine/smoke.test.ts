import { describe, it, expect } from '../testkit.ts';
import { createSeededCity } from './seed.ts';
import { addHabit } from './engine.ts';
import { replayDrafts } from './replay.ts';
import { setHabitLogged, openWindow } from '../persistence/drafts.ts';

describe('smoke', () => {
  it('arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });

  it('toggling a habit on then off returns to the un-logged city exactly (no drift)', () => {
    let base = createSeededCity();
    const b = base.boroughs[0];
    base = addHabit(base, { id: 'h1', name: 'Read', kind: 'good', weight: 2, target: { kind: 'borough', id: b.id }, createdAtISO: '2026-01-01', cadence: 'daily' });
    const today = '2026-06-27';
    const baseline = replayDrafts(base, openWindow({}, today, '2026-06-25'));

    const onStore = setHabitLogged({}, today, 'h1', 'good', true);
    const withLog = replayDrafts(base, openWindow(onStore, today, '2026-06-25'));
    expect(JSON.stringify(withLog)).not.toBe(JSON.stringify(baseline)); // logging changed health

    const offStore = setHabitLogged(onStore, today, 'h1', 'good', false);
    const undone = replayDrafts(base, openWindow(offStore, today, '2026-06-25'));
    expect(JSON.stringify(undone)).toBe(JSON.stringify(baseline)); // exact undo
  });
});
