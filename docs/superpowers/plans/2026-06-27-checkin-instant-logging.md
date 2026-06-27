# In-the-Moment Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bulk nightly check-in with instant per-habit logging — ticking a habit logs it immediately for a selected day (Today/Yesterday toggle), with per-district filter tabs — subsuming the Spec A "log yesterday" fix and de-crowding the panel.

**Architecture:** Persist a **full committed `CityState` base** (`polis.city`) plus a small **drafts store** (`polis.drafts`) holding the editable open window (yesterday + today). The displayed city = `replayDrafts(committedBase, openWindowDrafts)`, folding each draft day through the existing `applyCheckIn`/`advanceDay`. The engine is fully deterministic (no RNG), so replay reproduces sticky maturity/tiers/features/building-growth/day exactly and undo is drift-free. On load, days that age past the 2-day window commit into the base.

**Tech Stack:** TypeScript (strict), React 18 (no extra deps), esbuild build, `node --test` with the project's `testkit.ts` (`it`/`expect`). Pure logic in `src/engine` & `src/persistence`; UI in `src/ui`.

## Global Constraints

- **No new dependencies.** React + esbuild only.
- **No `CITY_VERSION` bump.** The `CityState` shape is unchanged; the change is the persistence envelope (new `polis.drafts` key) and the meaning of `polis.city` (now the committed base).
- **Engine purity:** only `todayISO()` reads the clock. Engine modules have zero DOM/render deps. Replay must remain deterministic — never introduce `Math.random`.
- **Reuse, don't reformulate:** Spec B's `habitDelta` (maintained/dueToday/overdue branches), `cadenceEmphasis`, `habitStatus`, `groupGoodHabits`, and `applyCheckIn`/`advanceDay` are reused verbatim.
- **localStorage keys:** `polis.city` (committed base), `polis.drafts` (open-window edits), `polis.lastResolved` (last committed day = the commit boundary). `polis.lastCheckIn` is retired.
- **Date helpers (exact):** `todayISO()`, `localDateISO(d)`, `addDaysISO(iso, n)`, `dayDiffISO(aISO, bISO)` (= `bISO − aISO` in whole days) — all from `src/engine/dates.ts`.
- **TDD + frequent commits.** Each task ends green with a commit.

## File Structure

- **Create `src/engine/replay.ts`** — `DraftInput` type + `replayDrafts(base, drafts[])`. Pure, deterministic.
- **Create `src/persistence/drafts.ts`** — `DraftStore`/`DraftDay` types; pure store ops (`dayDraft`, `setHabitLogged`, `openWindow`) + thin localStorage I/O (`loadDrafts`, `saveDrafts`).
- **Create `src/ui/habitDistrict.ts`** — map a habit → its `districtId` (via its target borough/landmark); group habits by district; per-district badge count.
- **Modify `src/persistence/storage.ts`** — rework `loadResolvedCity` to the commit-boundary model; add `openDraftWindow`; retire `canLogYesterday`; update `resetResolution`.
- **Modify `src/ui/App.tsx`** — hold `committed`/`drafts`/`lastResolved`/`selectedDay`/`selectedDistrictId`; derive displayed city via replay; replace bulk handlers with `handleToggleHabit`; route structural mutations through the committed base.
- **Modify `src/ui/CheckIn.tsx`** — remove bulk submit + yesterday button + staged state; add Today/Yesterday toggle, district tabs (with badges), instant checkboxes.
- **Modify `src/ui/CityMap.tsx`** — relabel the "Logged today ✓" CTA to a neutral "Log / edit today".

---

### Task 1: `replayDrafts` — deterministic fold of draft days

**Files:**
- Create: `src/engine/replay.ts`
- Test: `src/engine/replay.test.ts`

**Interfaces:**
- Consumes: `applyCheckIn(state, { completedHabitIds, loggedBadHabitIds, dateISO })` from `./engine.ts`; `CityState` from `./types.ts`.
- Produces: `interface DraftInput { dateISO: string; completedHabitIds: string[]; loggedBadHabitIds: string[] }` and `replayDrafts(base: CityState, drafts: DraftInput[]): CityState`.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/replay.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/engine/replay.test.ts`
Expected: FAIL — `Cannot find module './replay.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/replay.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/engine/replay.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/replay.ts src/engine/replay.test.ts
git commit -m "feat(checkin): deterministic replayDrafts fold of draft days"
```

---

### Task 2: Drafts store — pure ops + open window

**Files:**
- Create: `src/persistence/drafts.ts`
- Test: `src/persistence/drafts.test.ts`

**Interfaces:**
- Consumes: `DraftInput` from `../engine/replay.ts`; `addDaysISO`, `dayDiffISO` from `../engine/dates.ts`.
- Produces:
  - `type DraftDay = { completedHabitIds: string[]; loggedBadHabitIds: string[] }`
  - `type DraftStore = Record<string, DraftDay>`
  - `dayDraft(store: DraftStore, dateISO: string): DraftDay`
  - `setHabitLogged(store: DraftStore, dateISO: string, habitId: string, kind: 'good' | 'bad', on: boolean): DraftStore`
  - `openWindow(store: DraftStore, todayISO: string, lastResolved: string): DraftInput[]`
  - `loadDrafts(): DraftStore` / `saveDrafts(store: DraftStore): void` (localStorage I/O — not unit-tested here)

- [ ] **Step 1: Write the failing test**

```ts
// src/persistence/drafts.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/persistence/drafts.test.ts`
Expected: FAIL — `Cannot find module './drafts.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/persistence/drafts.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/persistence/drafts.test.ts`
Expected: PASS (7 tests).

> Note on `.toEqual`: the project's `testkit.ts` supports deep equality (used by existing tests). If a specific matcher is unavailable, assert on `JSON.stringify(value)` instead — do not add a dependency.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/drafts.ts src/persistence/drafts.test.ts
git commit -m "feat(checkin): drafts store (pure ops + open window)"
```

---

### Task 3: Commit-boundary load — `loadResolvedCity` rework

**Files:**
- Modify: `src/persistence/storage.ts` (replace `loadResolvedCity` body; add `openDraftWindow`; remove `canLogYesterday`; update `resetResolution`)
- Test: `src/persistence/storage.test.ts` (add cases)

**Interfaces:**
- Consumes: `loadDrafts`, `saveDrafts`, `openWindow` from `./drafts.ts`; `applyCheckIn`, `applyMissedDay` from `../engine/engine.ts`; `addDaysISO`, `dayDiffISO` from `../engine/dates.ts`; `DraftInput` from `../engine/replay.ts`.
- Produces:
  - `loadResolvedCity(todayISO: string): CityState` — now returns the **committed base** (today/yesterday NOT folded in); commits days aged past the 2-day window; sets `lastResolved = today−1` on first load when the marker is absent.
  - `openDraftWindow(todayISO: string): DraftInput[]` — reads `lastResolved` (defaulting to `today−1`) + the drafts store and returns the ordered open window.
  - `resetResolution(todayISO: string): void` — clears drafts and sets `lastResolved = today−1`.
  - **Removed:** `canLogYesterday`.

- [ ] **Step 1: Write the failing test**

```ts
// add to src/persistence/storage.test.ts
import { loadResolvedCity, openDraftWindow } from './storage.ts';
import { saveDrafts } from './drafts.ts';
import { addDaysISO } from '../engine/dates.ts';

it('loadResolvedCity on a fresh store sets lastResolved to yesterday and leaves today editable', () => {
  localStorage.clear();
  const today = '2026-06-27';
  const base = loadResolvedCity(today);
  expect(localStorage.getItem('polis.lastResolved')).toBe(addDaysISO(today, -1));
  // committed base is the seed (day 0) — today not folded in
  expect(base.day).toBe(0);
  // open window is just today
  expect(openDraftWindow(today).map((d) => d.dateISO)).toEqual([today]);
});

it('loadResolvedCity commits days that have aged past the 2-day window', () => {
  localStorage.clear();
  // Pretend we last resolved 5 days before today; no drafts → those days commit as missed.
  const today = '2026-06-27';
  loadResolvedCity(addDaysISO(today, -5)); // seeds + sets lastResolved = today-6
  const beforeDay = loadResolvedCity(today).day; // commits (today-6, today-2]
  // committed boundary is today-2; window is yesterday+today
  expect(localStorage.getItem('polis.lastResolved')).toBe(addDaysISO(today, -2));
  expect(openDraftWindow(today).map((d) => d.dateISO)).toEqual([addDaysISO(today, -1), today]);
  expect(beforeDay).toBeGreaterThan(0); // missed days advanced the committed base
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/persistence/storage.test.ts`
Expected: FAIL — `openDraftWindow` is not exported / `loadResolvedCity` returns old shape.

- [ ] **Step 3: Write minimal implementation**

Replace the existing `loadResolvedCity` and `canLogYesterday`/`resetResolution` region in `storage.ts` with:

```ts
import { loadDrafts, saveDrafts, openWindow } from './drafts.ts';
import type { DraftInput } from '../engine/replay.ts';
// (applyMissedDay is already imported; ensure applyCheckIn is too)
import { applyMissedDay, applyCheckIn } from '../engine/engine.ts';

/**
 * Load the committed base city (or seed one) and commit any whole day that has
 * aged past the 2-day editable window — entropy/missed for a day with no draft,
 * or the draft's logged habits for a day that has one. Today and yesterday stay
 * editable drafts (replayed on top by the UI). Returns the committed base.
 */
export function loadResolvedCity(todayISO: string): CityState {
  let base = loadCity() ?? createSeededCity();
  const lastResolved = localStorage.getItem(LAST_RESOLVED_KEY);

  const anchored = anchorStartDate(base, todayISO, lastResolved);
  if (anchored !== base) { base = anchored; saveCity(base); }

  if (lastResolved == null) {
    // New/migrated save: treat the base as committed through yesterday so today is editable.
    localStorage.setItem(LAST_RESOLVED_KEY, addDaysISO(todayISO, -1));
    return base;
  }

  const commitThrough = addDaysISO(todayISO, -2);
  if (dayDiffISO(lastResolved, commitThrough) > 0) {
    const store = loadDrafts();
    let nextStore = store;
    let s = base;
    let d = addDaysISO(lastResolved, 1);
    while (dayDiffISO(d, commitThrough) >= 0) {
      const draft = store[d];
      s = draft
        ? applyCheckIn(s, { completedHabitIds: draft.completedHabitIds, loggedBadHabitIds: draft.loggedBadHabitIds, dateISO: d })
        : applyMissedDay(s, d);
      if (nextStore[d]) {
        const { [d]: _removed, ...rest } = nextStore;
        nextStore = rest;
      }
      d = addDaysISO(d, 1);
    }
    base = s;
    saveCity(base);
    saveDrafts(nextStore);
    localStorage.setItem(LAST_RESOLVED_KEY, commitThrough);
  }
  return base;
}

/** The ordered editable open window (yesterday + today, or just today right after a fresh load). */
export function openDraftWindow(todayISO: string): DraftInput[] {
  const lastResolved = localStorage.getItem(LAST_RESOLVED_KEY) ?? addDaysISO(todayISO, -1);
  return openWindow(loadDrafts(), todayISO, lastResolved);
}

/** Reset day-resolution bookkeeping for a fresh seed: no drafts, today editable. */
export function resetResolution(todayISO: string): void {
  localStorage.removeItem(LAST_CHECKIN_KEY);
  saveDrafts({});
  localStorage.setItem(LAST_RESOLVED_KEY, addDaysISO(todayISO, -1));
}
```

Then **delete** the `canLogYesterday` function and the `getLastCheckIn`/`recordCheckIn` exports if unused after Task 4 (leave `getLastCheckIn` only if still referenced; remove `canLogYesterday` now).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/persistence/storage.test.ts`
Expected: PASS. If pre-existing tests referenced `canLogYesterday`/`recordCheckIn`, update or remove those assertions (they describe the retired bulk model).

- [ ] **Step 5: Commit**

```bash
git add src/persistence/storage.ts src/persistence/drafts.ts src/persistence/storage.test.ts
git commit -m "feat(checkin): commit-boundary loadResolvedCity + openDraftWindow; retire canLogYesterday"
```

---

### Task 4: Checked-state union helper (once-per-day)

**Files:**
- Modify: `src/persistence/drafts.ts` (add `isHabitLoggedForDay`)
- Test: `src/persistence/drafts.test.ts` (add cases)

**Interfaces:**
- Consumes: `Habit` from `../engine/types.ts`; `DraftStore`, `dayDraft` (same module).
- Produces: `isHabitLoggedForDay(store: DraftStore, dateISO: string, habit: Habit): boolean` — true when the habit is in that day's draft set OR (good habit whose committed `lastCompletedISO === dateISO`). This is the checkbox checked-state and the once-per-day / deploy-seam guard.

- [ ] **Step 1: Write the failing test**

```ts
// add to src/persistence/drafts.test.ts
import { isHabitLoggedForDay } from './drafts.ts';
import type { Habit } from '../engine/types.ts';

const good = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1', name: 'Read', kind: 'good', weight: 1,
  target: { kind: 'borough', id: 'b1' }, createdAtISO: '2026-01-01', cadence: 'daily', ...over,
});

it('isHabitLoggedForDay true when in the draft set', () => {
  const s = setHabitLogged({}, '2026-06-27', 'h1', 'good', true);
  expect(isHabitLoggedForDay(s, '2026-06-27', good())).toBe(true);
});

it('isHabitLoggedForDay true when committed lastCompletedISO matches the day (deploy seam)', () => {
  expect(isHabitLoggedForDay({}, '2026-06-27', good({ lastCompletedISO: '2026-06-27' }))).toBe(true);
});

it('isHabitLoggedForDay false when neither draft nor committed match', () => {
  expect(isHabitLoggedForDay({}, '2026-06-27', good({ lastCompletedISO: '2026-06-26' }))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/persistence/drafts.test.ts`
Expected: FAIL — `isHabitLoggedForDay` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// add to src/persistence/drafts.ts
import type { Habit } from '../engine/types.ts';

/** Checked-state for a habit on a day: in the draft set, or (good) committed that day. */
export function isHabitLoggedForDay(store: DraftStore, dateISO: string, habit: Habit): boolean {
  const d = dayDraft(store, dateISO);
  const field = habit.kind === 'good' ? d.completedHabitIds : d.loggedBadHabitIds;
  if (field.includes(habit.id)) return true;
  return habit.kind === 'good' && habit.lastCompletedISO === dateISO;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/persistence/drafts.test.ts`
Expected: PASS (all draft tests).

- [ ] **Step 5: Commit**

```bash
git add src/persistence/drafts.ts src/persistence/drafts.test.ts
git commit -m "feat(checkin): isHabitLoggedForDay union rule (once-per-day + deploy seam guard)"
```

---

### Task 5: Habit → district mapping, grouping, and badges

**Files:**
- Create: `src/ui/habitDistrict.ts`
- Test: `src/ui/habitDistrict.test.ts`

**Interfaces:**
- Consumes: `CityState`, `District`, `Habit` from `../engine/types.ts`; `groupGoodHabits` from `./checkinGroups.ts`; `habitStatus` from `../engine/cadence.ts`.
- Produces:
  - `habitDistrictId(city: CityState, habit: Habit): string | null` — resolves the habit's target borough/landmark to its `districtId`.
  - `habitsForDistrict(city: CityState, districtId: string): Habit[]`
  - `districtsWithHabits(city: CityState): District[]` — districts that have ≥1 habit, in city order.
  - `districtBadgeCount(city: CityState, districtId: string, todayISO: string): number` — count of that district's good habits whose status is `overdue` or `dueToday`.

- [ ] **Step 1: Write the failing test**

```ts
// src/ui/habitDistrict.test.ts
import { it, expect } from '../testkit.ts';
import { createSeededCity } from '../engine/seed.ts';
import { addHabit } from '../engine/engine.ts';
import type { Habit } from '../engine/types.ts';
import { habitDistrictId, habitsForDistrict, districtsWithHabits, districtBadgeCount } from './habitDistrict.ts';

function withBoroughHabit() {
  const city = createSeededCity();
  const borough = city.boroughs[0];
  const h: Habit = {
    id: 'h1', name: 'Read', kind: 'good', weight: 1,
    target: { kind: 'borough', id: borough.id }, createdAtISO: '2026-01-01',
    cadence: 'daily', lastCompletedISO: '2026-01-01', // long overdue vs a 2026-06 today
  };
  return { city: addHabit(city, h), districtId: borough.districtId };
}

it('habitDistrictId resolves a borough-targeted habit to its district', () => {
  const { city, districtId } = withBoroughHabit();
  expect(habitDistrictId(city, city.habits[city.habits.length - 1])).toBe(districtId);
});

it('habitsForDistrict returns that district\'s habits', () => {
  const { city, districtId } = withBoroughHabit();
  expect(habitsForDistrict(city, districtId).map((h) => h.id)).toEqual(['h1']);
});

it('districtsWithHabits lists only districts that have habits', () => {
  const { city, districtId } = withBoroughHabit();
  const ids = districtsWithHabits(city).map((d) => d.id);
  expect(ids).toEqual([districtId]);
});

it('districtBadgeCount counts overdue + due-today good habits', () => {
  const { city, districtId } = withBoroughHabit();
  expect(districtBadgeCount(city, districtId, '2026-06-27')).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/ui/habitDistrict.test.ts`
Expected: FAIL — `Cannot find module './habitDistrict.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/ui/habitDistrict.ts
import type { CityState, District, Habit } from '../engine/types.ts';
import { habitStatus } from '../engine/cadence.ts';

export function habitDistrictId(city: CityState, habit: Habit): string | null {
  if (habit.target.kind === 'borough') {
    return city.boroughs.find((b) => b.id === habit.target.id)?.districtId ?? null;
  }
  return city.landmarks.find((l) => l.id === habit.target.id)?.districtId ?? null;
}

export function habitsForDistrict(city: CityState, districtId: string): Habit[] {
  return city.habits.filter((h) => habitDistrictId(city, h) === districtId);
}

export function districtsWithHabits(city: CityState): District[] {
  const ids = new Set(city.habits.map((h) => habitDistrictId(city, h)).filter(Boolean) as string[]);
  return city.districts.filter((d) => ids.has(d.id));
}

export function districtBadgeCount(city: CityState, districtId: string, todayISO: string): number {
  return habitsForDistrict(city, districtId).filter((h) => {
    if (h.kind !== 'good') return false;
    const st = habitStatus({ cadence: h.cadence, anchorISO: h.lastCompletedISO ?? h.createdAtISO, todayISO });
    return st.state === 'overdue' || st.state === 'dueToday';
  }).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/ui/habitDistrict.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/habitDistrict.ts src/ui/habitDistrict.test.ts
git commit -m "feat(checkin): habit→district mapping, grouping, and badge counts"
```

---

### Task 6: App wiring — committed base + drafts + toggle handler

**Files:**
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `loadResolvedCity`, `openDraftWindow`, `saveCity` from `../persistence/storage.ts`; `loadDrafts`, `saveDrafts`, `setHabitLogged`, `isHabitLoggedForDay`, type `DraftStore` from `../persistence/drafts.ts`; `replayDrafts` from `../engine/replay.ts`; `todayISO`, `addDaysISO` from `../engine/dates.ts`.
- Produces (state + props for Task 7): `selectedDay: 'today' | 'yesterday'`, `selectedDistrictId: string | null`, `handleToggleHabit(habitId: string, kind: 'good' | 'bad', on: boolean): void`, `isLogged(habitId: string): boolean`, `canEditYesterday: boolean`.

> This task is UI integration; its gate is a clean typecheck/build (Task 9 runs the headless smoke). Keep all rendering correct and remove the retired bulk paths.

- [ ] **Step 1: Replace the load + state + handlers**

In `App.tsx`, replace the single-`city` model with a committed base + drafts, and replace `handleCheckIn`/`handleCheckInYesterday` with a toggle handler. Key shape:

```tsx
const today = todayISO();
const [committed, setCommitted] = useState<CityState | null>(null);
const [drafts, setDrafts] = useState<DraftStore>({});
const [selectedDay, setSelectedDay] = useState<'today' | 'yesterday'>('today');
const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);

useEffect(() => {
  const base = loadResolvedCity(today);
  setCommitted(base);
  setDrafts(loadDrafts());
}, [today]);

// Displayed city = committed base + replayed open-window drafts.
const draftWindow = openDraftWindow(today);            // ordered [yesterday?, today]
const city = committed ? replayDrafts(committed, draftWindow) : null;

const earliest = draftWindow[0]?.dateISO;              // yesterday in steady state
const canEditYesterday = draftWindow.length > 1;
const selectedDateISO = selectedDay === 'yesterday' && canEditYesterday ? earliest : today;

function handleToggleHabit(habitId: string, kind: 'good' | 'bad', on: boolean) {
  const nextDrafts = setHabitLogged(loadDrafts(), selectedDateISO, habitId, kind, on);
  saveDrafts(nextDrafts);
  setDrafts(nextDrafts);
}

function isLogged(habitId: string): boolean {
  if (!committed) return false;
  const habit = committed.habits.find((h) => h.id === habitId);
  return habit ? isHabitLoggedForDay(drafts, selectedDateISO, habit) : false;
}
```

- [ ] **Step 2: Route structural mutations through the committed base**

Every existing mutation that previously called `update(next)` (e.g. `addHabit`, habit edit/remove, profile name/birthday, add landmark, milestones) must mutate **committed** and persist it as `polis.city` (NOT the displayed city). Introduce:

```tsx
function commitMutation(nextCommitted: CityState) {
  setCommitted(nextCommitted);
  saveCity(nextCommitted);            // polis.city = committed base
}
```

Replace `update(addHabit(city, ...))` with `commitMutation(addHabit(committed!, ...))`, and likewise for the other structural handlers. Do **not** persist the displayed `city` anywhere.

- [ ] **Step 3: Remove retired wiring**

- Delete imports/usages of `canLogYesterday`, `recordCheckIn`, `getLastCheckIn`, `applyMissedDay`-on-checkin, and the `lastCheckIn`/`canCheckIn`/`yesterdayOpen` locals.
- Update the `CheckIn` render to pass the new props (Task 7 signature): `city`, `selectedDay`, `onSelectDay={setSelectedDay}`, `canEditYesterday`, `selectedDistrictId`, `onSelectDistrict={setSelectedDistrictId}`, `isLogged`, `onToggle={handleToggleHabit}`, `todayISO={selectedDateISO}`.
- Default the district once `city` is known: if `selectedDistrictId == null`, pick attention-first.

```tsx
useEffect(() => {
  if (!city || selectedDistrictId) return;
  const withHabits = districtsWithHabits(city);
  const attention = withHabits.find((d) => districtBadgeCount(city, d.id, today) > 0);
  setSelectedDistrictId((attention ?? withHabits[0])?.id ?? null);
}, [city, selectedDistrictId, today]);
```

- [ ] **Step 4: Typecheck via build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat(checkin): App committed-base + drafts model, instant toggle handler"
```

---

### Task 7: CheckIn rewrite — toggle, district tabs, instant checkboxes

**Files:**
- Modify: `src/ui/CheckIn.tsx`

**Interfaces:**
- Consumes (props from Task 6): `city: CityState`, `selectedDay: 'today' | 'yesterday'`, `onSelectDay(day)`, `canEditYesterday: boolean`, `selectedDistrictId: string | null`, `onSelectDistrict(id)`, `isLogged(habitId): boolean`, `onToggle(habitId, kind, on)`, `todayISO: string` (the selected date ISO, for status chips); plus `groupGoodHabits` from `./checkinGroups.ts`, `habitsForDistrict`/`districtsWithHabits`/`districtBadgeCount` from `./habitDistrict.ts`.
- Produces: the new check-in panel. No bulk submit, no `done`/`slipped` local state, no `canLogYesterday` props.

> UI task; gate is build + Task 9 smoke.

- [ ] **Step 1: Replace the component body**

Rewrite `CheckIn.tsx` to:
1. Render the **Today / Yesterday** toggle at top (`Yesterday` disabled when `!canEditYesterday`), calling `onSelectDay`.
2. Render **district tabs** from `districtsWithHabits(city)`, each labelled `district.name` with a badge when `districtBadgeCount(city, d.id, selectedDateISO) > 0`; clicking calls `onSelectDistrict(d.id)`; mark the selected one.
3. For the selected district, compute `const habits = habitsForDistrict(city, selectedDistrictId)` then `const groups = groupGoodHabits(habits, todayISO)` and render **Overdue → Due today → Maintained** exactly as today, plus a **Slips** group from `habits.filter(h => h.kind === 'bad')`.
4. Each checkbox is **instant**: `checked={isLogged(habit.id)}` and `onChange={(e) => onToggle(habit.id, habit.kind, e.target.checked)}`. No submit button.

Key render skeleton (preserve existing class names `checkin`, `checkin-cols`, `col-label`, `habit`, `muted`, `abandoned`):

```tsx
export function CheckIn({ city, selectedDay, onSelectDay, canEditYesterday, selectedDistrictId, onSelectDistrict, isLogged, onToggle, todayISO }: Props) {
  const districts = districtsWithHabits(city);
  const habits = selectedDistrictId ? habitsForDistrict(city, selectedDistrictId) : [];
  const groups = groupGoodHabits(habits, todayISO);
  const slips = habits.filter((h) => h.kind === 'bad');

  const row = (id: string, kind: 'good' | 'bad', label: React.ReactNode) => (
    <label key={id} className="habit">
      <input type="checkbox" checked={isLogged(id)} onChange={(e) => onToggle(id, kind, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="checkin">
      <div className="day-toggle">
        <button className={selectedDay === 'today' ? 'on' : ''} onClick={() => onSelectDay('today')}>Today</button>
        <button className={selectedDay === 'yesterday' ? 'on' : ''} disabled={!canEditYesterday} onClick={() => onSelectDay('yesterday')}>Yesterday</button>
      </div>

      <div className="district-tabs">
        {districts.map((d) => {
          const n = districtBadgeCount(city, d.id, todayISO);
          return (
            <button key={d.id} className={d.id === selectedDistrictId ? 'tab on' : 'tab'} onClick={() => onSelectDistrict(d.id)}>
              {d.name}{n > 0 && <span className="badge">{n}</span>}
            </button>
          );
        })}
      </div>

      {groups.overdue.length > 0 && (<><div className="col-label">Overdue</div>{groups.overdue.map(({ habit, status }) => row(habit.id, 'good', <>{habit.name}<span className="muted"> · overdue {status.daysOverdue}d</span></>))}</>)}
      {groups.dueToday.length > 0 && (<><div className="col-label">Due today</div>{groups.dueToday.map(({ habit }) => row(habit.id, 'good', <>{habit.name}<span className="muted"> · due today</span></>))}</>)}
      {groups.maintained.length > 0 && (<><div className="col-label">Maintained</div>{groups.maintained.map(({ habit, status }) => row(habit.id, 'good', <>{habit.name}<span className="muted"> ✓ maintained · due in {status.dueInDays}d</span></>))}</>)}
      {slips.length > 0 && (<><div className="col-label">Slips (mark if you did it)</div>{slips.map((h) => row(h.id, 'bad', h.name))}</>)}
      {habits.length === 0 && <p className="abandoned">none in this district yet</p>}
    </div>
  );
}
```

Define the `Props` interface to match the Task 6 props exactly, and `import type React from 'react'` (or use `import { type ReactNode }`) for the `label` typing.

- [ ] **Step 2: Add minimal styles**

Append to the hand-authored stylesheet `public/app.css` (loaded by `public/index.html`; there are no `src` CSS files): styles for `.day-toggle`, `.day-toggle .on`, `.district-tabs`, `.tab`, `.tab.on`, `.badge`. Keep visuals consistent with the existing palette (reuse existing button/`col-label` styles where possible).

- [ ] **Step 3: Typecheck via build**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/CheckIn.tsx public/app.css
git commit -m "feat(checkin): instant per-habit checkboxes + Today/Yesterday toggle + district tabs"
```

---

### Task 8: CityMap CTA relabel

**Files:**
- Modify: `src/ui/CityMap.tsx`

**Interfaces:**
- Consumes: existing `onLogToday` prop.
- Produces: the CTA always reads "Log / edit today" and is always enabled; the `canCheckIn` prop and its "Logged today ✓" branch are removed from this button.

- [ ] **Step 1: Edit the CTA**

In `CityMap.tsx` replace the button (around the current `canCheckIn === false ? 'Logged today ✓' : …` block) with:

```tsx
<button type="button" className="cta" onClick={onLogToday}>
  Log / edit today
</button>
```

Remove the now-unused `canCheckIn` prop from `CityMap`'s `Props` and from its call site in `App.tsx` if no longer referenced (leave it if other parts of `CityMap` still use it).

- [ ] **Step 2: Typecheck via build**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/CityMap.tsx src/ui/App.tsx
git commit -m "feat(checkin): neutral 'Log / edit today' CTA (drop logged-today binary)"
```

---

### Task 9: Full verification + headless smoke

**Files:**
- Test: `src/engine/smoke.test.ts` (extend) or a scratch headless check.

- [ ] **Step 1: Full suite green**

Run: `npm test`
Expected: PASS — all existing + new tests (replay, drafts, storage commit-boundary, habitDistrict). Fix any regressions in pre-existing storage/engine tests that referenced the retired `canLogYesterday`/`recordCheckIn` bulk model.

- [ ] **Step 2: Clean build**

Run: `npm run build`
Expected: success, no TypeScript errors, bundle emitted.

- [ ] **Step 3: Headless smoke — replay + toggle round-trip**

Add a smoke test (or extend `smoke.test.ts`) asserting the end-to-end model:

```ts
import { it, expect } from '../testkit.ts';
import { createSeededCity } from './seed.ts';
import { addHabit } from './engine.ts';
import { replayDrafts } from './replay.ts';
import { setHabitLogged, openWindow } from '../persistence/drafts.ts';

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
```

Run: `node --test src/engine/smoke.test.ts`
Expected: PASS.

- [ ] **Step 4: Manual review handoff**

Start a static server on the built app and stop for in-app review (no deploy, no screenshots). The build emits `public/app.js` and the app runs from `public/`:

```bash
npm run build && python3 -m http.server 8139 --directory public
```

Report the localhost URL, the new test count, and the four behaviors to verify:
1. **District tabs** — Log panel opens on an attention-first district; tabs filter; badges show overdue/due counts.
2. **Instant logging** — ticking a habit logs it immediately (status chip flips Overdue→Maintained); unticking undoes it.
3. **Today/Yesterday toggle** — switching to Yesterday lets you tick habits for yesterday; defaults to Today.
4. **Item 1 fixed** — on a freshly reset city you can log Today right away, and Yesterday becomes available after a day elapses (no missing "Log yesterday").

- [ ] **Step 5: Commit**

```bash
git add src/engine/smoke.test.ts
git commit -m "test(checkin): end-to-end replay + drift-free undo smoke"
```

---

## Self-Review

**Spec coverage:**
- §1 instant model → Tasks 2 (`setHabitLogged`), 4 (`isHabitLoggedForDay`), 6 (`handleToggleHabit`), 7 (checkboxes).
- §2 Today/Yesterday toggle + midnight rollover → Tasks 3 (commit boundary / `openDraftWindow`), 6 (`selectedDay`/`canEditYesterday`), 7 (toggle UI).
- §3 district tabs + status groups + Slips + badges + attention-first default → Tasks 5 (mapping/badges), 6 (default selection), 7 (tabs UI).
- §4 committed base + deterministic replay → Tasks 1 (`replayDrafts`), 3 (commit), 6 (display = replay).
- §5 removed/changed surface → Tasks 3 (`canLogYesterday` gone), 6 (bulk handlers gone), 7 (no submit), 8 (CTA).
- §6 migration (no version bump; `lastResolved=today−1` first load; deploy seam) → Tasks 3 + 4 (union guard).
- §7 testing → Tasks 1–5 unit tests + Task 9 suite/build/smoke.

**Placeholder scan:** none — every code step shows complete code; UI tasks gate on `npm run build` + Task 9 smoke (no DOM test harness in this project, consistent with the existing testkit).

**Type consistency:** `DraftInput` (replay.ts) reused by drafts.ts & storage.ts; `DraftStore`/`DraftDay` consistent across drafts.ts, App, tests; `setHabitLogged(store, dateISO, habitId, kind, on)`, `openWindow(store, todayISO, lastResolved)`, `isHabitLoggedForDay(store, dateISO, habit)`, `habitDistrictId(city, habit)`, `districtBadgeCount(city, districtId, todayISO)` — signatures match between definition (Tasks 1–5) and consumption (Tasks 6–7).

## Notes for the implementer

- The committed base is the **only** thing persisted as `polis.city`; the displayed city is always `replayDrafts(committed, openDraftWindow(today))` and is never saved. Saving the displayed city would double-count on the next load.
- Never apply replay on top of an already-replayed city. Always replay from `committed`.
- Keep `applyCheckIn`/`advanceDay`/`habitDelta`/`cadenceEmphasis` untouched — replay reuses them.
- Pre-existing tests that asserted the retired bulk model (`canLogYesterday`, `recordCheckIn`) should be updated/removed as part of the task that retires them (Task 3), keeping the suite green.
