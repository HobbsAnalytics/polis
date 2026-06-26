# Habit Cadence (Upkeep Model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each habit a cadence (daily/weekdays/weekly/twice-monthly/monthly) and make city health respond via an "upkeep" model: completing a habit maintains its building for its period, then it weathers gently once overdue.

**Architecture:** Add pure cadence helpers (`src/engine/cadence.ts`); make the engine's per-day habit math cadence-aware (deposit / maintained / overdue branches keyed on each habit's `lastCompletedISO` vs the day being processed); stamp `lastCompletedISO` on completion inside `advanceDay`; migrate saves v7→v8; surface cadence in the check-in (status groups) and Profile (dropdown). The engine stays pure — only `todayISO()` reads the clock (Spec A invariant).

**Tech Stack:** TypeScript (ESM, `.ts` imports), React, `node --test` with the repo's `src/testkit.ts` (`it`/`expect`). Build: `npm run build` (esbuild). Tests: `npm test`.

## Global Constraints

- Test runner: `node --test`; tests co-located as `*.test.ts`; import `{ it, expect }` from the appropriate-depth `testkit.ts` (`../testkit.ts` from `src/engine/`).
- `src/testkit.ts` has **no `toBeCloseTo`** — assert floats with `expect(Math.abs(actual - expected) < 1e-6).toBe(true)`.
- Only `todayISO()` (in `src/engine/dates.ts`) may read the wall clock. Engine/helpers stay pure on passed-in ISO dates.
- Date helpers live in `src/engine/dates.ts`: `dayDiffISO(aISO, bISO)` returns `bISO − aISO` in whole days; also `addDaysISO`, `todayISO`.
- Persistence localStorage key names are unchanged. `CITY_VERSION` goes **7 → 8** and MUST ship with its migration (loadCity drops any save whose version ≠ CITY_VERSION).
- Patina visual system unchanged — new UI (cadence dropdown, check-in groups) uses existing CSS tokens/classes; no restyle.
- Cadence is a **good-habit** concept; bad habits have no cadence and keep current behavior.
- `Habit.cadence` and `Habit.lastCompletedISO` are **optional** on the type; helpers treat missing `cadence` as `'daily'`. This avoids touching every existing `Habit` literal/fixture; migration still backfills persisted saves.

**Cadence periods (days):** `daily`=1, `weekdays`=1 (Mon–Fri; weekends neutral), `weekly`=7, `twiceMonthly`=15, `monthly`=30.
**Cadence emphasis:** `min(3, sqrt(periodDays))` → daily 1, weekly ≈2.6458, twiceMonthly→3 (√15≈3.87 capped), monthly→3.

---

### Task 1: Cadence period + emphasis helpers

**Files:**
- Modify: `src/engine/types.ts` (add `HabitCadence` type)
- Create: `src/engine/cadence.ts`
- Test: `src/engine/cadence.test.ts`

**Interfaces:**
- Produces: `type HabitCadence = 'daily' | 'weekdays' | 'weekly' | 'twiceMonthly' | 'monthly'`; `periodDays(c?: HabitCadence): number`; `cadenceEmphasis(c?: HabitCadence): number`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/cadence.test.ts
import { it, expect } from '../testkit.ts';
import { periodDays, cadenceEmphasis } from './cadence.ts';

it('periodDays maps each cadence; missing defaults to daily', () => {
  expect(periodDays('daily')).toBe(1);
  expect(periodDays('weekdays')).toBe(1);
  expect(periodDays('weekly')).toBe(7);
  expect(periodDays('twiceMonthly')).toBe(15);
  expect(periodDays('monthly')).toBe(30);
  expect(periodDays(undefined)).toBe(1);
});

it('cadenceEmphasis is sqrt(period) capped at 3; daily is 1', () => {
  expect(cadenceEmphasis('daily')).toBe(1);
  expect(Math.abs(cadenceEmphasis('weekly') - Math.sqrt(7)) < 1e-6).toBe(true);
  expect(cadenceEmphasis('twiceMonthly')).toBe(3); // sqrt(15)≈3.87 capped
  expect(cadenceEmphasis('monthly')).toBe(3);
  expect(cadenceEmphasis(undefined)).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/engine/cadence.test.ts`
Expected: FAIL — cannot find module `./cadence.ts` / exports undefined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/types.ts — add near HabitKind:
export type HabitCadence = 'daily' | 'weekdays' | 'weekly' | 'twiceMonthly' | 'monthly';
```

```ts
// src/engine/cadence.ts
import type { HabitCadence } from './types.ts';

const PERIOD: Record<HabitCadence, number> = {
  daily: 1,
  weekdays: 1,
  weekly: 7,
  twiceMonthly: 15,
  monthly: 30,
};

export function periodDays(c?: HabitCadence): number {
  return PERIOD[c ?? 'daily'];
}

/** Rarer habits matter somewhat more — sqrt(period), capped at 3x. */
export function cadenceEmphasis(c?: HabitCadence): number {
  return Math.min(3, Math.sqrt(periodDays(c)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/engine/cadence.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/cadence.ts src/engine/cadence.test.ts
git commit -m "feat(cadence): periodDays + cadenceEmphasis helpers"
```

---

### Task 2: habitStatus (maintained / due-today / overdue) helper

**Files:**
- Modify: `src/engine/cadence.ts`
- Test: `src/engine/cadence.test.ts`

**Interfaces:**
- Consumes: `periodDays`; `dayDiffISO` from `./dates.ts`.
- Produces: `interface HabitStatus { state: 'maintained' | 'dueToday' | 'overdue'; dueInDays: number; daysOverdue: number }` and `habitStatus(args: { cadence?: HabitCadence; anchorISO: string; todayISO: string }): HabitStatus`.
  - `anchorISO` is the habit's `lastCompletedISO ?? createdAtISO`.
  - `daysSince = dayDiffISO(anchorISO, todayISO)` (today − anchor).
  - `weekdays` special: if `todayISO` falls on Sat/Sun, return `{ state: 'maintained', dueInDays: <days to next Mon>, daysOverdue: 0 }` (weekend = neutral).
  - Else: `daysSince < period` → maintained, `dueInDays = period - daysSince`; `daysSince === period` → dueToday; `daysSince > period` → overdue, `daysOverdue = daysSince - period`.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/engine/cadence.test.ts
import { habitStatus } from './cadence.ts';

it('weekly: maintained within period, due at period, overdue after', () => {
  const a = '2026-06-01';
  expect(habitStatus({ cadence: 'weekly', anchorISO: a, todayISO: '2026-06-04' }).state).toBe('maintained'); // +3
  expect(habitStatus({ cadence: 'weekly', anchorISO: a, todayISO: '2026-06-04' }).dueInDays).toBe(4);
  expect(habitStatus({ cadence: 'weekly', anchorISO: a, todayISO: '2026-06-08' }).state).toBe('dueToday'); // +7
  const od = habitStatus({ cadence: 'weekly', anchorISO: a, todayISO: '2026-06-11' }); // +10
  expect(od.state).toBe('overdue');
  expect(od.daysOverdue).toBe(3);
});

it('daily: due the day after completion (legacy behavior anchor)', () => {
  expect(habitStatus({ cadence: 'daily', anchorISO: '2026-06-10', todayISO: '2026-06-11' }).state).toBe('dueToday');
});

it('weekdays: weekend is neutral (maintained)', () => {
  // 2026-06-13 is a Saturday, 2026-06-14 Sunday, 2026-06-15 Monday
  expect(habitStatus({ cadence: 'weekdays', anchorISO: '2026-06-12', todayISO: '2026-06-13' }).state).toBe('maintained');
  expect(habitStatus({ cadence: 'weekdays', anchorISO: '2026-06-12', todayISO: '2026-06-15' }).state).toBe('dueToday');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/engine/cadence.test.ts`
Expected: FAIL — `habitStatus` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/cadence.ts — add:
import { dayDiffISO } from './dates.ts';

export interface HabitStatus {
  state: 'maintained' | 'dueToday' | 'overdue';
  dueInDays: number;
  daysOverdue: number;
}

function isWeekend(iso: string): boolean {
  const dow = new Date(iso + 'T00:00:00').getDay(); // 0=Sun..6=Sat
  return dow === 0 || dow === 6;
}
function daysToNextWeekday(iso: string): number {
  const dow = new Date(iso + 'T00:00:00').getDay();
  return dow === 6 ? 2 : dow === 0 ? 1 : 0;
}

export function habitStatus(args: {
  cadence?: import('./types.ts').HabitCadence;
  anchorISO: string;
  todayISO: string;
}): HabitStatus {
  const { cadence, anchorISO, todayISO } = args;
  if (cadence === 'weekdays' && isWeekend(todayISO)) {
    return { state: 'maintained', dueInDays: daysToNextWeekday(todayISO), daysOverdue: 0 };
  }
  const period = periodDays(cadence);
  const daysSince = dayDiffISO(anchorISO, todayISO);
  if (daysSince < period) return { state: 'maintained', dueInDays: period - daysSince, daysOverdue: 0 };
  if (daysSince === period) return { state: 'dueToday', dueInDays: 0, daysOverdue: 0 };
  return { state: 'overdue', dueInDays: 0, daysOverdue: daysSince - period };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/engine/cadence.test.ts`
Expected: PASS (all cadence tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/cadence.ts src/engine/cadence.test.ts
git commit -m "feat(cadence): habitStatus maintained/dueToday/overdue + weekday weekend-skip"
```

---

### Task 3: Add Habit fields + Settings tunables (no behavior change yet)

**Files:**
- Modify: `src/engine/types.ts` (Habit fields; Settings fields)
- Modify: `src/engine/settings.ts` (DEFAULT_SETTINGS values)
- Test: `src/engine/settings.test.ts` (create if absent)

**Interfaces:**
- Produces: `Habit.cadence?: HabitCadence`, `Habit.lastCompletedISO?: string`; `Settings` gains `upkeepDailyGain`, `overdueErosionBase`, `overdueGrowthPerDay`, `overdueGrowthCapDays`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/settings.test.ts
import { it, expect } from '../testkit.ts';
import { DEFAULT_SETTINGS } from './settings.ts';

it('default settings include upkeep tunables', () => {
  expect(DEFAULT_SETTINGS.upkeepDailyGain).toBe(0.012);
  expect(DEFAULT_SETTINGS.overdueErosionBase).toBe(0.03);
  expect(DEFAULT_SETTINGS.overdueGrowthPerDay).toBe(0.15);
  expect(DEFAULT_SETTINGS.overdueGrowthCapDays).toBe(14);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/engine/settings.test.ts`
Expected: FAIL — properties `undefined`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/types.ts — extend Habit:
//   cadence?: HabitCadence;
//   /** ISO date the habit was last completed (good habits). */
//   lastCompletedISO?: string;
// (import/define HabitCadence already added in Task 1)

// src/engine/types.ts — extend Settings interface with:
//   upkeepDailyGain: number;
//   overdueErosionBase: number;
//   overdueGrowthPerDay: number;
//   overdueGrowthCapDays: number;
```

```ts
// src/engine/settings.ts — add to DEFAULT_SETTINGS (keep existing keys):
//   upkeepDailyGain: 0.012,
//   overdueErosionBase: 0.03,
//   overdueGrowthPerDay: 0.15,
//   overdueGrowthCapDays: 14,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/engine/settings.test.ts && npm test`
Expected: settings test PASS; full suite still green (no behavior change — engine not yet using cadence).

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/settings.ts src/engine/settings.test.ts
git commit -m "feat(cadence): add Habit cadence/lastCompletedISO + upkeep Settings tunables"
```

---

### Task 4: Cadence-aware habitDelta / updateScalar

**Files:**
- Modify: `src/engine/engine.ts` (`habitDelta`, `updateScalar`, and the `upd`/`containerDelta` call sites in `advanceDay`)
- Test: `src/engine/cadence-engine.test.ts`

**Interfaces:**
- Consumes: `habitStatus`, `cadenceEmphasis` from `./cadence.ts`.
- Produces (new signatures — `checkedIn` removed; `today` added):
  - `habitDelta(habits: Habit[], completed: Set<string>, logged: Set<string>, s: Settings, todayISO: string): number`
  - `updateScalar(current: number, habits: Habit[], completed: Set<string>, logged: Set<string>, s: Settings, todayISO: string): number`
- Branch math per **good** habit `h` (emphasis `e = cadenceEmphasis(h.cadence)`):
  - completed today → `+ s.goodHabitGain * h.weight * e` (the deposit)
  - else `status = habitStatus({ cadence: h.cadence, anchorISO: h.lastCompletedISO ?? h.createdAtISO, todayISO })`:
    - `maintained` → `+ s.upkeepDailyGain * h.weight * e`
    - `dueToday` → `- s.overdueErosionBase * h.weight * e`
    - `overdue` → `- s.overdueErosionBase * (1 + Math.min(status.daysOverdue, s.overdueGrowthCapDays) * s.overdueGrowthPerDay) * h.weight * e`
  - **bad** habit (unchanged): if `logged.has(h.id)` → `- s.badHabitPenalty * h.weight`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/cadence-engine.test.ts
import { it, expect } from '../testkit.ts';
import { habitDelta } from './engine.ts';
import { DEFAULT_SETTINGS } from './settings.ts';
import type { Habit } from './types.ts';

const s = DEFAULT_SETTINGS;
const good = (over: Partial<Habit>): Habit => ({
  id: 'h', name: 'h', kind: 'good', weight: 1,
  target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-01-01', ...over,
});
const none = new Set<string>();

it('completed today deposits goodHabitGain * weight * emphasis', () => {
  const h = good({ cadence: 'weekly', lastCompletedISO: '2026-06-01' });
  const d = habitDelta([h], new Set(['h']), none, s, '2026-06-05');
  expect(Math.abs(d - s.goodHabitGain * 1 * Math.sqrt(7)) < 1e-6).toBe(true);
});

it('maintained (not done, within period) gives small upkeep positive', () => {
  const h = good({ cadence: 'weekly', lastCompletedISO: '2026-06-01' });
  const d = habitDelta([h], none, none, s, '2026-06-04'); // +3 < 7
  expect(Math.abs(d - s.upkeepDailyGain * 1 * Math.sqrt(7)) < 1e-6).toBe(true);
});

it('overdue erodes, growing with days overdue', () => {
  const h = good({ cadence: 'weekly', lastCompletedISO: '2026-06-01' });
  const at8 = habitDelta([h], none, none, s, '2026-06-08'); // dueToday (+7)
  const at11 = habitDelta([h], none, none, s, '2026-06-11'); // overdue 3
  expect(at8 < 0).toBe(true);
  expect(at11 < at8).toBe(true); // more overdue = more negative
});

it('daily equivalence: done = +goodHabitGain, missed next day = -overdueErosionBase (weight 1)', () => {
  const h = good({ cadence: 'daily', lastCompletedISO: '2026-06-10' });
  expect(Math.abs(habitDelta([h], new Set(['h']), none, s, '2026-06-11') - s.goodHabitGain) < 1e-6).toBe(true);
  expect(Math.abs(habitDelta([h], none, none, s, '2026-06-11') - -s.overdueErosionBase) < 1e-6).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/engine/cadence-engine.test.ts`
Expected: FAIL — current `habitDelta` signature/behavior differs (no `today`, no cadence branches).

- [ ] **Step 3: Write minimal implementation**

Replace `habitDelta` and `updateScalar` in `src/engine/engine.ts`:

```ts
import { habitStatus, cadenceEmphasis } from './cadence.ts';

export function habitDelta(
  habits: Habit[],
  completed: Set<string>,
  logged: Set<string>,
  s: Settings,
  todayISO: string,
): number {
  let delta = 0;
  for (const h of habits) {
    if (h.kind === 'good') {
      const e = cadenceEmphasis(h.cadence);
      if (completed.has(h.id)) {
        delta += s.goodHabitGain * h.weight * e;
      } else {
        const st = habitStatus({
          cadence: h.cadence,
          anchorISO: h.lastCompletedISO ?? h.createdAtISO,
          todayISO,
        });
        if (st.state === 'maintained') {
          delta += s.upkeepDailyGain * h.weight * e;
        } else if (st.state === 'dueToday') {
          delta -= s.overdueErosionBase * h.weight * e;
        } else {
          const growth = 1 + Math.min(st.daysOverdue, s.overdueGrowthCapDays) * s.overdueGrowthPerDay;
          delta -= s.overdueErosionBase * growth * h.weight * e;
        }
      }
    } else if (logged.has(h.id)){
      delta -= s.badHabitPenalty * h.weight;
    }
  }
  return delta;
}

export function updateScalar(
  current: number,
  habits: Habit[],
  completed: Set<string>,
  logged: Set<string>,
  s: Settings,
  todayISO: string,
): number {
  return clamp01(current + habitDelta(habits, completed, logged, s, todayISO) - s.entropyPerDay);
}
```

Update the two call sites inside `advanceDay` to drop `input.checkedIn` and pass the day's date (`const today = input.dateISO ?? '';`):

```ts
const upd = (current: number, kind: 'district' | 'borough' | 'landmark', id: string) =>
  updateScalar(current, habitsTargeting(state.habits, kind, id), completed, logged, s, today);
// ...
d = habitDelta(habitsTargeting(state.habits, kind, id), completed, logged, s, today);
```

(`input.checkedIn` is still recorded in the log entry; it is simply no longer used by the habit math — the maintained/overdue branches supersede the old missed-checkin distinction.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/engine/cadence-engine.test.ts && npm test`
Expected: cadence-engine PASS. Fix any now-broken legacy engine tests that asserted the old missed-checkin gradient — update them to the new single-erosion behavior (a daily habit missed on a checked-in day and a missed day now erode equally at `overdueErosionBase`). Do NOT weaken cadence tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engine.ts src/engine/cadence-engine.test.ts src/engine/*.test.ts
git commit -m "feat(cadence): cadence-aware habitDelta/updateScalar (upkeep model)"
```

---

### Task 5: Stamp lastCompletedISO on completion in advanceDay

**Files:**
- Modify: `src/engine/engine.ts` (`advanceDay` — set `next.habits`)
- Test: `src/engine/cadence-engine.test.ts`

**Interfaces:**
- Consumes: existing `advanceDay`/`applyCheckIn`/`applyMissedDay`.
- Produces: after a check-in dated `D`, every completed good habit has `lastCompletedISO === D` in the returned state; non-completed habits and missed days leave it unchanged (so overdue accrues across catch-up).

- [ ] **Step 1: Write the failing test**

```ts
// append to src/engine/cadence-engine.test.ts
import { createCity, addHabit, applyCheckIn, applyMissedDay } from './engine.ts';

it('applyCheckIn stamps lastCompletedISO on completed good habits', () => {
  let c = createCity({ boroughs: [{ id: 'b', districtId: 'd', name: 'b', healthDirect: 0.5 }], districts: [{ id: 'd', name: 'd', description: '', healthDirect: 0.5, maturity: 0, features: [] }] });
  c = addHabit(c, { id: 'h', name: 'h', kind: 'good', weight: 1, target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-06-01', cadence: 'weekly' });
  const after = applyCheckIn(c, { completedHabitIds: ['h'], loggedBadHabitIds: [], dateISO: '2026-06-05' });
  expect(after.habits.find((x) => x.id === 'h')?.lastCompletedISO).toBe('2026-06-05');
});

it('missed day leaves lastCompletedISO unchanged', () => {
  let c = createCity({ boroughs: [{ id: 'b', districtId: 'd', name: 'b', healthDirect: 0.5 }], districts: [{ id: 'd', name: 'd', description: '', healthDirect: 0.5, maturity: 0, features: [] }] });
  c = addHabit(c, { id: 'h', name: 'h', kind: 'good', weight: 1, target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-06-01', cadence: 'weekly', lastCompletedISO: '2026-06-01' });
  const after = applyMissedDay(c, '2026-06-03');
  expect(after.habits.find((x) => x.id === 'h')?.lastCompletedISO).toBe('2026-06-01');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/engine/cadence-engine.test.ts`
Expected: FAIL — `lastCompletedISO` not updated (stays at create value / undefined).

- [ ] **Step 3: Write minimal implementation**

In `advanceDay`, after computing `completed` and before building `next`, derive updated habits and include them in `next`:

```ts
const today = input.dateISO ?? '';
const nextHabits = state.habits.map((h) =>
  h.kind === 'good' && completed.has(h.id) && today ? { ...h, lastCompletedISO: today } : h,
);
```

Add `habits: nextHabits,` to the `next` object literal (it currently inherits `...state`, so add the explicit key to override).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/engine/cadence-engine.test.ts && npm test`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engine.ts src/engine/cadence-engine.test.ts
git commit -m "feat(cadence): stamp lastCompletedISO on completion in advanceDay"
```

---

### Task 6: Migration v7 → v8 (CITY_VERSION bump)

**Files:**
- Modify: `src/engine/settings.ts` (`CITY_VERSION = 8`)
- Modify: `src/persistence/storage.ts` (add `migrateV7toV8`, chain it)
- Test: `src/persistence/storage.test.ts`

**Interfaces:**
- Consumes: existing `migrate` chain (`o.version === 7` step), `DayLog` shape (`completedHabitIds`, `dateISO`).
- Produces: a v7 save loads as v8 with every habit having `cadence: 'daily'` (if missing) and `lastCompletedISO` = the most recent log `dateISO` whose `completedHabitIds` includes the habit, else the habit's `createdAtISO`.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/persistence/storage.test.ts (follow existing import style there)
import { it, expect } from '../testkit.ts';
import { loadCity, saveCity } from './storage.ts';

it('migrates v7 habits to v8: default daily cadence + backfilled lastCompletedISO', () => {
  const v7 = {
    version: 7,
    day: 3,
    districts: [], boroughs: [], landmarks: [], neighborhoods: [], milestones: [],
    profile: { name: 'X', birthDateISO: '1988-11-26', lifespanYears: 75, startDateISO: '2026-06-01' },
    settings: {}, // loadCity merges defaults via isCityState? if strict, copy DEFAULT_SETTINGS here
    habits: [
      { id: 'h1', name: 'a', kind: 'good', weight: 1, target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-06-01' },
      { id: 'h2', name: 'b', kind: 'good', weight: 1, target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-06-01' },
    ],
    log: [
      { day: 1, dateISO: '2026-06-02', checkedIn: true, completedHabitIds: ['h1'], loggedBadHabitIds: [], netHealthChange: 0, snapshot: { neighborhoods: [], landmarks: [] } },
      { day: 2, dateISO: '2026-06-03', checkedIn: true, completedHabitIds: ['h1'], loggedBadHabitIds: [], netHealthChange: 0, snapshot: { neighborhoods: [], landmarks: [] } },
    ],
  };
  localStorage.setItem('polis.city', JSON.stringify(v7));
  const c = loadCity();
  expect(c).not.toBe(null);
  const h1 = c!.habits.find((h) => h.id === 'h1')!;
  const h2 = c!.habits.find((h) => h.id === 'h2')!;
  expect(h1.cadence).toBe('daily');
  expect(h1.lastCompletedISO).toBe('2026-06-03'); // latest log completing h1
  expect(h2.lastCompletedISO).toBe('2026-06-01'); // never completed → createdAtISO
});
```

> Note: if `loadCity`'s `isCityState` requires full `settings`, set `settings: DEFAULT_SETTINGS` in the fixture (import it). Match whatever the existing storage tests do for fixtures.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/persistence/storage.test.ts`
Expected: FAIL — `loadCity` returns null (version 7 ≠ 8) or habits lack cadence/lastCompletedISO.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/settings.ts
export const CITY_VERSION = 8;
```

```ts
// src/persistence/storage.ts — in migrate(), after the v6→v7 step:
  if (o.version === 7) {
    o = migrateV7toV8(o);
  }
```

```ts
// src/persistence/storage.ts — add helper:
function migrateV7toV8(o: Record<string, unknown>): Record<string, unknown> {
  const habits = Array.isArray(o.habits) ? (o.habits as Record<string, unknown>[]) : [];
  const log = Array.isArray(o.log) ? (o.log as Record<string, unknown>[]) : [];
  const migratedHabits = habits.map((h) => {
    if (h.kind !== 'good') return { ...h, cadence: h.cadence ?? 'daily' };
    let last: string | undefined;
    for (const entry of log) {
      const ids = Array.isArray(entry.completedHabitIds) ? (entry.completedHabitIds as string[]) : [];
      const dISO = typeof entry.dateISO === 'string' ? entry.dateISO : '';
      if (ids.includes(h.id as string) && dISO) last = last && last > dISO ? last : dISO;
    }
    return {
      ...h,
      cadence: h.cadence ?? 'daily',
      lastCompletedISO: h.lastCompletedISO ?? last ?? h.createdAtISO,
    };
  });
  return { ...o, habits: migratedHabits, version: 8 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/persistence/storage.test.ts && npm test`
Expected: PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/settings.ts src/persistence/storage.ts src/persistence/storage.test.ts
git commit -m "feat(cadence): migrate saves v7->v8 (default daily + backfill lastCompletedISO)"
```

---

### Task 7: Check-in status grouping helper + CheckIn UI

**Files:**
- Create: `src/ui/checkinGroups.ts`
- Modify: `src/ui/CheckIn.tsx`
- Modify: `src/ui/App.tsx` (pass `today` to `CheckIn`)
- Test: `src/ui/checkinGroups.test.ts`

**Interfaces:**
- Consumes: `habitStatus`, `HabitStatus` from `../engine/cadence.ts`; `Habit`.
- Produces: `interface GroupedHabit { habit: Habit; status: HabitStatus }`; `groupGoodHabits(habits: Habit[], todayISO: string): { overdue: GroupedHabit[]; dueToday: GroupedHabit[]; maintained: GroupedHabit[] }` — only `kind === 'good'`, each bucket sorted by `habit.name`.

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/checkinGroups.test.ts
import { it, expect } from '../testkit.ts';
import { groupGoodHabits } from './checkinGroups.ts';
import type { Habit } from '../engine/types.ts';

const g = (id: string, over: Partial<Habit>): Habit => ({
  id, name: id, kind: 'good', weight: 1,
  target: { kind: 'borough', id: 'b' }, createdAtISO: '2026-06-01', ...over,
});

it('buckets good habits by status; ignores bad habits', () => {
  const habits: Habit[] = [
    g('m', { cadence: 'weekly', lastCompletedISO: '2026-06-08' }),   // +2 maintained
    g('d', { cadence: 'weekly', lastCompletedISO: '2026-06-03' }),   // +7 dueToday
    g('o', { cadence: 'weekly', lastCompletedISO: '2026-05-30' }),   // +11 overdue
    { ...g('bad', {}), kind: 'bad' },
  ];
  const r = groupGoodHabits(habits, '2026-06-10');
  expect(r.maintained.map((x) => x.habit.id)).toEqual(['m']);
  expect(r.dueToday.map((x) => x.habit.id)).toEqual(['d']);
  expect(r.overdue.map((x) => x.habit.id)).toEqual(['o']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/ui/checkinGroups.test.ts`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ui/checkinGroups.ts
import type { Habit } from '../engine/types.ts';
import { habitStatus, type HabitStatus } from '../engine/cadence.ts';

export interface GroupedHabit { habit: Habit; status: HabitStatus; }

export function groupGoodHabits(habits: Habit[], todayISO: string) {
  const overdue: GroupedHabit[] = [];
  const dueToday: GroupedHabit[] = [];
  const maintained: GroupedHabit[] = [];
  for (const habit of habits) {
    if (habit.kind !== 'good') continue;
    const status = habitStatus({ cadence: habit.cadence, anchorISO: habit.lastCompletedISO ?? habit.createdAtISO, todayISO });
    (status.state === 'overdue' ? overdue : status.state === 'dueToday' ? dueToday : maintained).push({ habit, status });
  }
  const byName = (a: GroupedHabit, b: GroupedHabit) => a.habit.name.localeCompare(b.habit.name);
  return { overdue: overdue.sort(byName), dueToday: dueToday.sort(byName), maintained: maintained.sort(byName) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/ui/checkinGroups.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into CheckIn.tsx**

Add a `todayISO: string` prop to `CheckIn`. Replace the flat good-habits list with three sections rendered from `groupGoodHabits(habits, todayISO)`:
- **Overdue** (heading shown only if non-empty) — each row label `name` + a muted chip `· overdue Nd` (from `status.daysOverdue`).
- **Due today** — each row label `name` + muted `· due today`.
- **Maintained** — wrapper class adds a greyed look (reuse an existing muted class, e.g. `muted`); each row `name` + `✓ maintained · due in N days` (`status.dueInDays`).
Keep every checkbox tickable when `canCheckIn` (logging a maintained habit early is allowed). Bad-habits column is unchanged. Update `App.tsx` to pass `todayISO={todayISO()}` (import `todayISO` from `../engine/dates.ts`) to `<CheckIn>`.

- [ ] **Step 6: Run build + suite**

Run: `npm run build && npm test`
Expected: clean build; full suite green.

- [ ] **Step 7: Commit**

```bash
git add src/ui/checkinGroups.ts src/ui/checkinGroups.test.ts src/ui/CheckIn.tsx src/ui/App.tsx
git commit -m "feat(cadence): status-grouped check-in (overdue/due today/maintained)"
```

---

### Task 8: Cadence dropdown in Profile add-habit form

**Files:**
- Modify: `src/ui/ProfilePage.tsx` (`NewHabitInput` type, `AddHabitForm`)
- Modify: `src/ui/App.tsx` (`handleCreateHabit` sets `cadence` + `lastCompletedISO`)
- Test: manual (UI) — covered by Task 9 smoke.

**Interfaces:**
- Consumes: `HabitCadence` from `../engine/types.ts`.
- Produces: `onCreateHabit` payload includes `cadence?: HabitCadence`; App stamps `cadence` and `lastCompletedISO: createdAtISO` onto the new habit.

- [ ] **Step 1: Extend the input type + form state**

In `ProfilePage.tsx`: add `cadence?: HabitCadence` to the `NewHabitInput` type (the `onCreateHabit` arg shape, ~line 8). In `AddHabitForm`, add `const [cadence, setCadence] = useState<HabitCadence>('daily');` and include `cadence` in the `onCreateHabit({...})` payload (only meaningful for good habits).

- [ ] **Step 2: Render the dropdown (good habits only)**

After the importance select, when `kind === 'good'`, render:

```tsx
<label>
  Cadence
  <select name="habitCadence" value={cadence} onChange={(e) => setCadence(e.target.value as HabitCadence)}>
    <option value="daily">Daily</option>
    <option value="weekdays">Weekdays</option>
    <option value="weekly">Weekly</option>
    <option value="twiceMonthly">Twice a month</option>
    <option value="monthly">Monthly</option>
  </select>
</label>
```

- [ ] **Step 3: Stamp it on create in App.tsx**

In `handleCreateHabit`, include on the new habit object: `cadence: input.cadence ?? 'daily', lastCompletedISO: todayISO()` (new habit starts maintained for its first period — its grace).

- [ ] **Step 4: Build + suite**

Run: `npm run build && npm test`
Expected: clean build; full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ProfilePage.tsx src/ui/App.tsx
git commit -m "feat(cadence): cadence dropdown in add-habit form + create wiring"
```

---

### Task 9: Verify end-to-end + localhost handoff

**Files:** none (verification only).

- [ ] **Step 1: Full suite + build**

Run: `npm test && npm run build`
Expected: all tests pass (incl. all new cadence tests); clean build; `public/app.js` rebuilt. Stage the rebuilt bundle if changed.

- [ ] **Step 2: Headless smoke (Playwright)**

Drive `public/` on a local server. Verify: (a) Profile add-habit form shows the Cadence dropdown with the five options for a good habit; (b) creating a weekly habit then opening the check-in shows it under **Due today** or **Maintained** with a "due in N days"/status label; (c) an existing v7 save (seed localStorage with a v7 fixture, reload) loads without error and habits default to daily — health values preserved. Screenshots only for the agent's own verification; do NOT gather them for user review.

- [ ] **Step 3: Start a static server for in-app review**

Run: `cd public && python3 -m http.server <port> --bind 127.0.0.1` (background). Confirm `index.html` + `app.js` return 200.

- [ ] **Step 4: Pause foruser review**

Report the localhost URL and the four behaviors to check (cadence dropdown; status-grouped check-in; maintained-vs-overdue feel; existing-save migration). **NO push/deploy** until the user approves.

---

## Notes / tuning

- Default constants (`upkeepDailyGain 0.012`, `overdueErosionBase 0.03`, `overdueGrowthPerDay 0.15`, `overdueGrowthCapDays 14`) are starting points. During Task 9, sanity-check the "feel": a maintained building should hold/creep up (upkeep 0.012 > entropy 0.01 at weight 1), a daily miss should match legacy (~0.03 drop), and a monthly habit ignored for ~2 weeks should visibly but gently weather (emphasis 3 × growing erosion). Adjust in `settings.ts` if needed and re-run the suite.
- `testkit.ts` lacks `toBeCloseTo` — use `expect(Math.abs(a - b) < 1e-6).toBe(true)`.
- Spec A's `dayDiffISO(a, b) = b − a` days; `todayISO()` is the only clock read.
