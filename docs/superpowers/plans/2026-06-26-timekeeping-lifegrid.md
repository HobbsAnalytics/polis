# Timekeeping & Life-grid (Spec A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the day counter (frozen at Day 0), reset "Logged today" on the local calendar day, add a "Log yesterday" grace window, and anchor the Life-in-weeks grid rows to the user's real birthday.

**Architecture:** All four items are calendar/clock work. The strategy is pure-function-first: make the wall-clock bridge (`todayISO`) and the date→cell math pure and TDD them, then wire the UI. The engine's append-only day log is preserved — the "log yesterday" grace is implemented by *deferring* yesterday's missed-day resolution (holding its slot open), never by rewriting a chained log entry.

**Tech Stack:** TypeScript, React (function components + hooks), esbuild build (`npm run build`), Node test runner (`node --test`) with the repo's `testkit.ts` (`it`, `expect`, `beforeEach`). No new dependencies.

## Global Constraints

- Test runner: `node --test` (alias `npm test`). Tests are co-located `*.test.ts` and import from `../testkit.ts` (or `./testkit.ts`). Matchers: `toBe`, `toEqual`, `toBeNull`, `toBeTruthy`, etc.
- Build must stay clean: `npm run build` (esbuild → `public/app.js`). Rebuild `public/app.js` before any commit that changes `src/`.
- Patina design system is unchanged — no restyle; reuse existing CSS tokens/classes.
- Pure engine/date modules stay clock-free except the single intentional helper `todayISO()` in `src/engine/dates.ts`.
- Persistence keys are unchanged: `polis.city`, `polis.lastResolved`, `polis.lastCheckIn`. The onboarding `polis.splash.seen` key is untouched.
- Save/version stays at `CITY_VERSION = 7`; this is an in-place back-fill of `startDateISO`, not a version bump.
- Worktree/branch: do all work on a feature branch off `main`; deploy = merge/commit to `main` (origin = HobbsAnalytics/polis), Pages auto-deploys.

---

## File Structure

- `src/engine/dates.ts` — add pure `localDateISO(d: Date)`; `todayISO()` delegates to it. (Item 3a)
- `src/engine/lifeline.ts` — add birthday-anchored mapping (`birthdayInYear`, `lifeCell`, `lifeCellIndex`); rework `buildLifeline`, `weeklyHealthChange`, and remove the fixed-week `weekSundayISO`/`weekIndex` usage for the grid. (Item 5)
- `src/ui/LifePage.tsx` — consume the new mapping for status, tint, milestones, hover labels. (Item 5)
- `src/persistence/storage.ts` — anchor/back-fill `startDateISO`; grace-window resolution (`loadResolvedCity` resolves to `today−2`, holds `today−1` open); `canLogYesterday`; `recordCheckIn(dateISO)` generalized. (Items 1, 2)
- `src/engine/engine.ts` — `cityDay` already depends only on `startDateISO`; add a unit test pinning that contract (Item 1). No logic change expected.
- `src/ui/App.tsx` — header always "Day N"; date-rollover listener; "Log yesterday" wiring. (Items 1, 2, 3b)
- `src/ui/CheckIn.tsx` — second action "Log yesterday" + copy. (Item 2)

---

## Task 1: Local calendar date (`localDateISO` / `todayISO`)

**Files:**
- Modify: `src/engine/dates.ts`
- Test: `src/engine/dates.test.ts` (Create)

**Interfaces:**
- Produces: `localDateISO(d: Date): string` (YYYY-MM-DD from local Y/M/D); `todayISO(): string` (now delegates to `localDateISO(new Date())`).

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/dates.test.ts
import { it, expect } from '../testkit.ts';
import { localDateISO, addDaysISO, dayDiffISO } from './dates.ts';

it('localDateISO uses local Y/M/D, not the UTC slice', () => {
  // 2026-06-26 21:30 local — must return that local date even though, in a
  // UTC-negative offset, toISOString() would already read 2026-06-27.
  const d = new Date(2026, 5, 26, 21, 30, 0); // month is 0-based → June
  expect(localDateISO(d)).toBe('2026-06-26');
});

it('localDateISO zero-pads month and day', () => {
  expect(localDateISO(new Date(2026, 0, 5, 0, 0, 0))).toBe('2026-01-05');
});

it('addDaysISO / dayDiffISO still round-trip', () => {
  expect(addDaysISO('2026-06-26', 1)).toBe('2026-06-27');
  expect(dayDiffISO('2026-06-26', '2026-06-28')).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/engine/dates.test.ts`
Expected: FAIL — `localDateISO` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/dates.ts — add near todayISO()
const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD from a Date's LOCAL components (not UTC). */
export function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as YYYY-MM-DD (local). The only clock-reading helper. */
export function todayISO(): string {
  return localDateISO(new Date());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/engine/dates.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/dates.ts src/engine/dates.test.ts
git commit -m "fix(dates): todayISO uses local calendar date, not UTC"
```

---

## Task 2: Birthday-anchored Life mapping (pure)

**Files:**
- Modify: `src/engine/lifeline.ts`
- Test: `src/engine/lifeline.test.ts`

**Interfaces:**
- Produces:
  - `birthdayInYear(birthDateISO: string, calendarYear: number): string` — the birthday in that calendar year as YYYY-MM-DD; a Feb-29 birthday clamps to Feb-28 in non-leap years.
  - `lifeCell(birthDateISO: string, dateISO: string): { row: number; cell: number } | null` — `row` = age in whole years at `dateISO`; `cell` = `min(51, floor(daysSinceThatYearsBirthday / 7))`. Returns `null` when `dateISO` precedes birth.
  - `lifeCellIndex(birthDateISO: string, dateISO: string): number` — `row * 52 + cell`, or `-1` when before birth.
- Consumes: `localDateISO`/`addDaysISO`/`dayDiffISO` from Task 1.

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/engine/lifeline.test.ts
import { birthdayInYear, lifeCell, lifeCellIndex } from './lifeline.ts';

it('birthdayInYear returns the birthday in the given calendar year', () => {
  expect(birthdayInYear('1988-11-26', 1990)).toBe('1990-11-26');
  expect(birthdayInYear('1988-11-26', 2025)).toBe('2025-11-26');
});

it('birthdayInYear clamps Feb-29 to Feb-28 in non-leap years', () => {
  expect(birthdayInYear('2000-02-29', 2001)).toBe('2001-02-28');
  expect(birthdayInYear('2000-02-29', 2004)).toBe('2004-02-29');
});

it('lifeCell puts the birthday on cell 0 of the right row, every year', () => {
  const b = '1988-11-26';
  expect(lifeCell(b, '1988-11-26')).toEqual({ row: 0, cell: 0 });
  expect(lifeCell(b, '1990-11-26')).toEqual({ row: 2, cell: 0 });
  expect(lifeCell(b, '2025-11-26')).toEqual({ row: 37, cell: 0 });
});

it('lifeCell steps weeks within a row and caps the final cell at 51', () => {
  const b = '1988-11-26';
  expect(lifeCell(b, '1988-12-03')).toEqual({ row: 0, cell: 1 }); // +7 days
  // day 360 of the year → past 51*7=357 → capped at 51, NOT spilling to row 1
  expect(lifeCell(b, '1989-11-21')).toEqual({ row: 0, cell: 51 });
});

it('lifeCell returns null before birth; lifeCellIndex returns -1', () => {
  expect(lifeCell('1988-11-26', '1988-11-25')).toBeNull();
  expect(lifeCellIndex('1988-11-26', '1988-11-25')).toBe(-1);
});

it('lifeCellIndex = row*52 + cell', () => {
  expect(lifeCellIndex('1988-11-26', '1990-11-26')).toBe(104);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/engine/lifeline.test.ts`
Expected: FAIL — new functions not exported.

- [ ] **Step 3: Implement the mapping**

```ts
// src/engine/lifeline.ts — add (keep existing exports that are still used)
const pad = (n: number) => String(n).padStart(2, '0');

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** The birthday within `calendarYear`; Feb-29 clamps to Feb-28 off leap years. */
export function birthdayInYear(birthDateISO: string, calendarYear: number): string {
  const [, mm, dd] = birthDateISO.split('-').map(Number);
  let day = dd;
  if (mm === 2 && dd === 29 && !isLeap(calendarYear)) day = 28;
  return `${calendarYear}-${pad(mm)}-${pad(day)}`;
}

/** Row = whole-year age; cell = capped week offset from that year's birthday. */
export function lifeCell(
  birthDateISO: string,
  dateISO: string,
): { row: number; cell: number } | null {
  if (Date.parse(dateISO) < Date.parse(birthDateISO)) return null;
  const birthY = Number(birthDateISO.slice(0, 4));
  const dateY = Number(dateISO.slice(0, 4));
  // Walk down from an upper-bound year to the birthday-year the date falls in.
  let row = dateY - birthY;
  while (row >= 0 && Date.parse(birthdayInYear(birthDateISO, birthY + row)) > Date.parse(dateISO)) {
    row -= 1;
  }
  const anchor = birthdayInYear(birthDateISO, birthY + row);
  const days = Math.floor((Date.parse(dateISO) - Date.parse(anchor)) / MS_PER_DAY);
  const cell = Math.min(51, Math.floor(days / 7));
  return { row, cell };
}

export function lifeCellIndex(birthDateISO: string, dateISO: string): number {
  const c = lifeCell(birthDateISO, dateISO);
  return c ? c.row * WEEKS_PER_YEAR + c.cell : -1;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/engine/lifeline.test.ts`
Expected: PASS (all, including pre-existing).

- [ ] **Step 5: Commit**

```bash
git add src/engine/lifeline.ts src/engine/lifeline.test.ts
git commit -m "feat(lifeline): birthday-anchored row/cell mapping"
```

---

## Task 3: Rework `buildLifeline` + `weeklyHealthChange` onto the mapping

**Files:**
- Modify: `src/engine/lifeline.ts`
- Test: `src/engine/lifeline.test.ts`

**Interfaces:**
- `weeklyHealthChange(log, birthDateISO)` now keys by `lifeCellIndex` (was `weekIndex`).
- `buildLifeline(profile, todayISO, eras)` unchanged signature; `weeksLived` = `completedRows * 52 + currentCell`; `age` = current row; week status (lived/current/future) is computed against the *today* cell index. Each `WeekCellVM` keeps `index` = its `lifeCellIndex` value (`row*52 + w`).

- [ ] **Step 1: Write/adjust failing tests**

```ts
// in src/engine/lifeline.test.ts — replace the fixed-week expectations
it('weeklyHealthChange buckets days into birthday-anchored cells', () => {
  const b = '1988-11-26';
  const m = weeklyHealthChange(
    [log('1988-11-26', 0.2), log('1988-11-27', -0.05), log('1990-11-26', -0.3), log('', 99)],
    b,
  );
  expect(m.get(0)).toBeCloseTo(0.15, 5);  // both first-row, cell 0
  expect(m.get(104)).toBeCloseTo(-0.3, 5); // row 2 cell 0
  expect(m.get(undefined as unknown as number)).toBe(undefined);
});

it('buildLifeline marks the today cell as current and prior cells lived', () => {
  const profile = { name: 'x', birthDateISO: '1988-11-26', lifespanYears: 75, startDateISO: '2020-01-01' };
  const vm = buildLifeline(profile, '1990-12-03', LIFE_ERAS); // row 2, cell ~1
  const row2 = vm.years[2];
  expect(row2.weeks[0].status).toBe('lived');
  expect(row2.weeks[1].status).toBe('current');
  expect(row2.weeks[2].status).toBe('future');
  expect(vm.age).toBe(2);
});
```

(`toBeCloseTo` — if `testkit.ts` lacks it, assert with `Math.abs(...) < 1e-6` instead.)

- [ ] **Step 2: Run to verify failure** — `node --test src/engine/lifeline.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// weeklyHealthChange: swap weekIndex → lifeCellIndex
export function weeklyHealthChange(log: DayLog[], birthDateISO: string): Map<number, number> {
  const byCell = new Map<number, number>();
  for (const d of log) {
    if (!d.dateISO) continue;
    const idx = lifeCellIndex(birthDateISO, d.dateISO);
    if (idx < 0) continue;
    byCell.set(idx, (byCell.get(idx) ?? 0) + d.netHealthChange);
  }
  return byCell;
}

// buildLifeline: compute the "today" cell and base status on it.
export function buildLifeline(profile: Profile, todayISO: string, eras: EraDef[]): LifelineVM {
  const totalWeeks = profile.lifespanYears * WEEKS_PER_YEAR;
  const todayCell = lifeCell(profile.birthDateISO, todayISO); // null if before birth
  const curRow = todayCell ? todayCell.row : -1;
  const curCell = todayCell ? todayCell.cell : -1;
  const livedIndex = todayCell ? curRow * WEEKS_PER_YEAR + curCell : 0;
  const age = Math.max(0, curRow);
  const seenEra = new Set<string>();

  const years: YearRowVM[] = [];
  for (let y = 0; y < profile.lifespanYears; y++) {
    const era = currentEra(y, eras);
    const eraStart = !seenEra.has(era.id);
    seenEra.add(era.id);
    const weeks: WeekCellVM[] = [];
    for (let w = 0; w < WEEKS_PER_YEAR; w++) {
      const index = y * WEEKS_PER_YEAR + w;
      const status: WeekStatus =
        index < livedIndex ? 'lived' : index === livedIndex ? 'current' : 'future';
      weeks.push({ index, status });
    }
    years.push({ yearIndex: y, eraId: era.id, eraStart, weeks });
  }

  const weeksLived = todayCell ? curRow * WEEKS_PER_YEAR + curCell : 0;
  return {
    totalWeeks,
    weeksLived,
    weeksLeft: Math.max(0, totalWeeks - weeksLived),
    age,
    currentEraId: currentEra(age, eras).id,
    years,
  };
}
```

Remove now-unused `weeksLived`/`ageYears`/`weekSundayISO` **only if** no other module imports them; otherwise leave them and add a comment. (Check with `grep -rn "weekSundayISO\|ageYears\|weeksLived" src`.) `LifePage` will stop importing `weekSundayISO` in Task 4.

- [ ] **Step 4: Run to verify pass** — `node --test src/engine/lifeline.test.ts` → PASS. Also run the whole suite: `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/lifeline.ts src/engine/lifeline.test.ts
git commit -m "feat(lifeline): build grid + health buckets from birthday-anchored cells"
```

---

## Task 4: LifePage consumes the new mapping (hover labels, tint, milestones)

**Files:**
- Modify: `src/ui/LifePage.tsx`

**Interfaces:**
- Consumes `lifeCellIndex`, `lifeCell`, `birthdayInYear` from `lifeline.ts`. No more `weekSundayISO`/`weekIndex` imports.

- [ ] **Step 1: Update milestone + tint bucketing to `lifeCellIndex`**

In `LifePage`, replace every `weekIndex(profile.birthDateISO, m.dateISO)` with `lifeCellIndex(profile.birthDateISO, m.dateISO)` (in `isOnChart` and the `byWeek` map build). Replace the `changeByWeek` lookups (already keyed by index) — they now read the `lifeCellIndex` keys produced in Task 3, so no change beyond the import.

- [ ] **Step 2: Fix the hover label to the cell's real date**

Replace `boxInfo`'s date line so cell 0 shows that row's birthday and other cells show their week-start date:

```ts
const boxInfo = (index: number, isBirthday: boolean, year: number): string => {
  const row = Math.floor(index / 52);
  const cell = index % 52;
  const birthY = Number(profile.birthDateISO.slice(0, 4));
  const anchor = birthdayInYear(profile.birthDateISO, birthY + row);
  const cellStart = addDaysISO(anchor, cell * 7);
  let t = `Week of ${formatDate(cellStart)}`;
  if (isBirthday) t += ` · Birthday (age ${year})`;
  const trend = weekTrend(changeByWeek.get(index));
  if (trend !== 'none') t += ` · city ${TREND_LABEL[trend]}`;
  const ms = byWeek.get(index);
  if (ms) t += ` · ${ms.map((m) => m.label).join(', ')}`;
  return t;
};
```

Add `import { addDaysISO } from '../engine/dates.ts';` and update the lifeline import line to `lifeCellIndex, birthdayInYear` (drop `weekSundayISO`). The `i === 0 ? 'life-birthday'` class stays — cell 0 IS the birthday now, correctly.

- [ ] **Step 3: Build + manual check**

Run: `npm run build` → expect clean. Start a static server (`node scripts/dev.mjs` or `python3 -m http.server` in `public/`), open the Life tab, set birthday 1988-11-26 on Profile, hover the highlighted box in several rows → every one reads "Week of Nov 26, <year> · Birthday (age N)".

- [ ] **Step 4: Commit**

```bash
git add src/ui/LifePage.tsx public/app.js
git commit -m "feat(life): hover dates + tint anchored to the birthday week each row"
```

---

## Task 5: `cityDay` contract test + always-on header (Item 1, part 1)

**Files:**
- Test: `src/engine/engine.test.ts` (append)
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Pins: `cityDay(profile, todayISO)` returns `0` when `startDateISO` is `''`, else `dayDiff(startDateISO, today) + 1` (min 1).

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/engine.test.ts — append
import { cityDay } from './engine.ts';

it('cityDay counts from startDateISO regardless of name', () => {
  expect(cityDay({ name: '', birthDateISO: '1988-11-26', lifespanYears: 75, startDateISO: '' }, '2026-06-26')).toBe(0);
  expect(cityDay({ name: '', birthDateISO: '1988-11-26', lifespanYears: 75, startDateISO: '2026-06-20' }, '2026-06-26')).toBe(7);
  expect(cityDay({ name: 'Hobbs', birthDateISO: '1988-11-26', lifespanYears: 75, startDateISO: '2026-06-26' }, '2026-06-26')).toBe(1);
});
```

- [ ] **Step 2: Run** — `node --test src/engine/engine.test.ts`. Expected: PASS already (contract holds); if `cityDay` isn't exported add the export. This task pins behavior so Task 6's back-fill is what actually unfreezes the counter.

- [ ] **Step 3: Header always shows Day N**

In `src/ui/App.tsx`, change the subtitle so the day counter never depends on `named`:

```tsx
<p className="subtitle">
  {named ? `${city.profile.name}'s city` : 'Your city, your self'} · day {day}
  {!named && ' · name your city on the Profile tab'}
</p>
```

(`day` is already `cityDay(city.profile, todayISO())`. Keep the "name your city" nudge as a trailing hint only.)

- [ ] **Step 4: Build** — `npm run build` clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engine.test.ts src/ui/App.tsx public/app.js
git commit -m "feat(day): header shows Day N independent of naming; pin cityDay contract"
```

---

## Task 6: Anchor + back-fill `startDateISO` on load (Item 1, part 2)

**Files:**
- Modify: `src/persistence/storage.ts`
- Test: `src/persistence/storage.test.ts`

**Interfaces:**
- Produces: `anchorStartDate(state: CityState, todayISO: string): CityState` — pure; if `profile.startDateISO` already set, returns state unchanged; else sets it to the earliest non-empty `log[].dateISO`, else the `polis.lastResolved` marker (read by caller and passed in), else `todayISO`.
- `loadResolvedCity` calls the anchor (passing the marker it already reads) and `saveCity`s when it changes.

- [ ] **Step 1: Write failing tests**

```ts
// src/persistence/storage.test.ts — append (localStorage cleared by beforeEach)
import { anchorStartDate } from './storage.ts';

const prof = (startDateISO = '') => ({ name: 'Hobbs', birthDateISO: '1988-11-26', lifespanYears: 75, startDateISO });

it('anchorStartDate keeps an existing startDateISO', () => {
  const s = { ...createSeededCity(), profile: prof('2026-01-01') };
  expect(anchorStartDate(s, '2026-06-26', null).profile.startDateISO).toBe('2026-01-01');
});

it('anchorStartDate back-fills from the earliest log date', () => {
  const base = createSeededCity();
  const s = { ...base, profile: prof(''), log: [
    { ...base.log[0] ?? {}, day: 1, dateISO: '2026-03-10', checkedIn: true, completedHabitIds: [], loggedBadHabitIds: [], netHealthChange: 0, snapshot: { neighborhoods: [], landmarks: [] } },
    { day: 2, dateISO: '2026-03-11', checkedIn: false, completedHabitIds: [], loggedBadHabitIds: [], netHealthChange: 0, snapshot: { neighborhoods: [], landmarks: [] } },
  ] } as unknown as CityState;
  expect(anchorStartDate(s, '2026-06-26', '2026-06-25').profile.startDateISO).toBe('2026-03-10');
});

it('anchorStartDate falls back to the resolved marker, then today', () => {
  const s = { ...createSeededCity(), profile: prof('') };
  expect(anchorStartDate(s, '2026-06-26', '2026-06-20').profile.startDateISO).toBe('2026-06-20');
  expect(anchorStartDate({ ...s }, '2026-06-26', null).profile.startDateISO).toBe('2026-06-26');
});
```

- [ ] **Step 2: Run** — `node --test src/persistence/storage.test.ts` → FAIL (`anchorStartDate` missing).

- [ ] **Step 3: Implement**

```ts
// src/persistence/storage.ts
export function anchorStartDate(state: CityState, todayISO: string, lastResolved: string | null): CityState {
  if (state.profile.startDateISO) return state;
  const dated = state.log.map((d) => d.dateISO).filter(Boolean).sort();
  const start = dated[0] ?? lastResolved ?? todayISO;
  return { ...state, profile: { ...state.profile, startDateISO: start } };
}
```

Wire into `loadResolvedCity` — read the marker once, anchor, persist if changed:

```ts
export function loadResolvedCity(todayISO: string): CityState {
  let s = loadCity() ?? createSeededCity();
  const lastResolved = localStorage.getItem(LAST_RESOLVED_KEY);

  const anchored = anchorStartDate(s, todayISO, lastResolved);
  if (anchored !== s) { s = anchored; saveCity(s); }

  if (lastResolved == null) {
    localStorage.setItem(LAST_RESOLVED_KEY, todayISO);
  } else {
    const missed = Math.max(0, dayDiffISO(lastResolved, todayISO) - 2); // grace: hold yesterday open
    if (missed > 0) {
      s = catchUpMissedDays(s, missed, addDaysISO(lastResolved, 1));
      localStorage.setItem(LAST_RESOLVED_KEY, addDaysISO(todayISO, -2));
      saveCity(s);
    }
  }
  return s;
}
```

(The `- 2` / `today−2` marker is the grace-window change shared with Task 7; land it here.)

- [ ] **Step 4: Run** — `node --test src/persistence/storage.test.ts` and `npm test` → PASS. Update any existing `loadResolvedCity` test that assumed `−1`/`today−1` to the new `−2`/`today−2` (search `lastResolved` assertions).

- [ ] **Step 5: Commit**

```bash
git add src/persistence/storage.ts src/persistence/storage.test.ts
git commit -m "fix(day): back-fill startDateISO on load; grace-window resolution"
```

---

## Task 7: `canLogYesterday` + `recordCheckIn(dateISO)` (Item 2, persistence)

**Files:**
- Modify: `src/persistence/storage.ts`
- Test: `src/persistence/storage.test.ts`

**Interfaces:**
- Produces:
  - `recordCheckIn(dateISO: string): void` — sets BOTH `polis.lastResolved` and `polis.lastCheckIn` to `dateISO`. (Was implicitly "today"; now takes the logged day so "log yesterday" sets them to yesterday.)
  - `canLogYesterday(todayISO: string): boolean` — reads the markers: true iff yesterday (`today−1`) is unresolved (`lastResolved == null || dayDiffISO(lastResolved, today) >= 2`) AND today is not yet logged (`lastCheckIn !== today`).

- [ ] **Step 1: Write failing tests**

```ts
// src/persistence/storage.test.ts — append
import { canLogYesterday, recordCheckIn, getLastCheckIn } from './storage.ts';

it('canLogYesterday: open when marker is ≤ today-2 and today not logged', () => {
  localStorage.setItem('polis.lastResolved', '2026-06-24'); // today-2
  expect(canLogYesterday('2026-06-26')).toBe(true);
});

it('canLogYesterday: closed once yesterday is resolved', () => {
  localStorage.setItem('polis.lastResolved', '2026-06-25'); // yesterday resolved
  expect(canLogYesterday('2026-06-26')).toBe(false);
});

it('canLogYesterday: closed once today is logged', () => {
  localStorage.setItem('polis.lastResolved', '2026-06-24');
  localStorage.setItem('polis.lastCheckIn', '2026-06-26');
  expect(canLogYesterday('2026-06-26')).toBe(false);
});

it('recordCheckIn(dateISO) stamps both markers to that day', () => {
  recordCheckIn('2026-06-25');
  expect(getLastCheckIn()).toBe('2026-06-25');
  expect(localStorage.getItem('polis.lastResolved')).toBe('2026-06-25');
});
```

- [ ] **Step 2: Run** — `node --test src/persistence/storage.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
export function recordCheckIn(dateISO: string): void {
  localStorage.setItem(LAST_RESOLVED_KEY, dateISO);
  localStorage.setItem(LAST_CHECKIN_KEY, dateISO);
}

export function canLogYesterday(todayISO: string): boolean {
  const lastResolved = localStorage.getItem(LAST_RESOLVED_KEY);
  const lastCheckIn = localStorage.getItem(LAST_CHECKIN_KEY);
  const yesterdayOpen = lastResolved == null || dayDiffISO(lastResolved, todayISO) >= 2;
  return yesterdayOpen && lastCheckIn !== todayISO;
}
```

(`recordCheckIn`'s call site in `App.tsx` already passes today; it keeps working because today is a valid `dateISO`.)

- [ ] **Step 4: Run** — `node --test src/persistence/storage.test.ts` and `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/storage.ts src/persistence/storage.test.ts
git commit -m "feat(checkin): canLogYesterday + dated recordCheckIn"
```

---

## Task 8: "Log yesterday" in the check-in modal (Item 2, UI)

**Files:**
- Modify: `src/ui/CheckIn.tsx`, `src/ui/App.tsx`
- Engine reused: `applyCheckIn`, `applyMissedDay` (both already accept `dateISO`).

**Interfaces:**
- `CheckIn` gains props: `canLogYesterday: boolean`, `onCompleteYesterday(good, bad)`. Existing `onComplete` is the "today" path.
- `App` adds `handleCheckInYesterday` and `handleCheckIn` resolves an open yesterday as missed first.

- [ ] **Step 1: App handlers**

```tsx
// src/ui/App.tsx
import { applyCheckIn, applyMissedDay, /* … */ } from '../engine/engine.ts';
import { /* … */ canLogYesterday, recordCheckIn } from '../persistence/storage.ts';
import { addDaysISO } from '../engine/dates.ts';

function handleCheckIn(completedHabitIds: string[], loggedBadHabitIds: string[]) {
  if (!city) return;
  const today = todayISO();
  let next = city;
  // Preserve chronological order: an unlogged-yet-open yesterday becomes missed.
  if (canLogYesterday(today)) next = applyMissedDay(next, addDaysISO(today, -1));
  next = applyCheckIn(next, { completedHabitIds, loggedBadHabitIds, dateISO: today });
  recordCheckIn(today);
  setLastCheckIn(today);
  update(next);
}

function handleCheckInYesterday(completedHabitIds: string[], loggedBadHabitIds: string[]) {
  if (!city) return;
  const yesterday = addDaysISO(todayISO(), -1);
  const next = applyCheckIn(city, { completedHabitIds, loggedBadHabitIds, dateISO: yesterday });
  recordCheckIn(yesterday);       // markers → yesterday; today stays open
  setLastCheckIn(yesterday);
  update(next);
}
```

Compute `const yesterdayOpen = canLogYesterday(todayISO());` alongside `canCheckIn`, and pass to the modal:

```tsx
<CheckIn
  habits={city.habits}
  canCheckIn={canCheckIn}
  canLogYesterday={yesterdayOpen}
  onComplete={(g, b) => { handleCheckIn(g, b); setCheckInOpen(false); }}
  onCompleteYesterday={(g, b) => { handleCheckInYesterday(g, b); setCheckInOpen(false); }}
/>
```

- [ ] **Step 2: CheckIn second action**

In `src/ui/CheckIn.tsx`, add the props and a secondary button + a one-line hint. The same `done`/`slipped` selections submit to whichever day:

```tsx
interface Props {
  habits: Habit[];
  canCheckIn: boolean;
  canLogYesterday: boolean;
  onComplete: (good: string[], bad: string[]) => void;
  onCompleteYesterday: (good: string[], bad: string[]) => void;
}
// …inside the component, under the primary button:
{canLogYesterday && (
  <>
    <button
      onClick={() => onCompleteYesterday([...done], [...slipped])}
      className="btn"
      style={{ marginTop: '0.5rem' }}
    >
      Log these for yesterday instead
    </button>
    <p className="muted" style={{ marginTop: '0.5rem' }}>
      Forgot yesterday? Log it before today — once you log today, yesterday closes.
    </p>
  </>
)}
```

Keep the primary "Complete check-in" button as the today path (`onClick={() => onComplete([...done], [...slipped])}` — adjust if it currently calls a local `submit`; route `submit` to `onComplete`).

- [ ] **Step 3: Build + manual check**

`npm run build` clean. Manual: with markers simulating an open yesterday (`localStorage.setItem('polis.lastResolved', <today-2>)` in console, reload), open Log today → both buttons show; "Log yesterday" writes a dated entry (verify in History) and leaves "Log today" still available; logging today with yesterday open inserts a missed yesterday then today (History shows both, in order).

- [ ] **Step 4: Commit**

```bash
git add src/ui/CheckIn.tsx src/ui/App.tsx public/app.js
git commit -m "feat(checkin): Log yesterday grace action in the daily modal"
```

---

## Task 9: Date-rollover listener (Item 3, part 2)

**Files:**
- Modify: `src/ui/App.tsx`

**Interfaces:** none new — an effect that re-resolves when the local date changes.

- [ ] **Step 1: Add the effect**

```tsx
// src/ui/App.tsx — after the init effect
useEffect(() => {
  const resync = () => {
    const t = todayISO();
    // Re-resolve if a new calendar day arrived since we last rendered.
    setCity(loadResolvedCity(t));
    setLastCheckIn(getLastCheckIn());
  };
  const onVisible = () => { if (document.visibilityState === 'visible') resync(); };
  window.addEventListener('focus', resync);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('focus', resync);
    document.removeEventListener('visibilitychange', onVisible);
  };
}, []);
```

(`loadResolvedCity` is idempotent when no day has passed — `missed` is 0 and the marker is untouched — so re-running on every focus is safe and cheap. It also re-anchors `startDateISO` harmlessly.)

- [ ] **Step 2: Build + manual check**

`npm run build` clean. Manual: open the app, then in console set `polis.lastCheckIn` to yesterday and blur/refocus the tab → "Logged today" flips back to a checkable state without a manual reload.

- [ ] **Step 3: Commit**

```bash
git add src/ui/App.tsx public/app.js
git commit -m "fix(checkin): re-resolve on focus/visibility so the day flips at midnight"
```

---

## Task 10: Full verification & ship

**Files:** none (verification + deploy).

- [ ] **Step 1: Whole suite + build**

Run: `npm test` (expect all green; count ≥ prior 60 + the new tests) and `npm run build` (clean). Confirm `public/app.js` is rebuilt and committed.

- [ ] **Step 2: Headless smoke (the four behaviors)**

Serve `public/` and drive headless (Playwright MCP or `scripts/dev.mjs`):
1. Named city shows **Day N** (N ≥ 1), not Day 0. (Seed a city with `startDateISO` a few days back via console, reload.)
2. Set `lastCheckIn` = yesterday, refocus → "Logged today" becomes checkable.
3. Open yesterday (marker = today−2) → "Log yesterday" present; log it → History shows a dated checked-in entry for yesterday and today is still loggable.
4. Life tab, birthday 1988-11-26 → the highlighted box in rows for 1990 and 2025 both hover "Week of Nov 26, …". (This is the agent's own verification; no screenshots for the user.)

- [ ] **Step 3: Review on localhost**

Leave a static server running and hand the URL to the user for in-app review (no screenshots). Wait for approval.

- [ ] **Step 4: Deploy (after approval)**

Safety check first: `git remote -v` (origin = HobbsAnalytics/polis) and `gh auth status` (active = HobbsAnalytics). Then merge the feature branch to `main` (or commit there), push (Databricks secret scan runs), watch the Pages deploy to success, and verify the live site (page 200; Day N renders; "Log yesterday" code present). Report commit SHA + run id.

---

## Self-Review

**Spec coverage:**
- Item 1 (day counter) → Tasks 5 (header + contract) + 6 (anchor/back-fill). ✓
- Item 2 (log yesterday) → Tasks 6 (grace window) + 7 (markers/canLogYesterday) + 8 (UI). ✓
- Item 3 (local date + rollover) → Tasks 1 (local `todayISO`) + 9 (focus/visibility re-resolve). ✓
- Item 5 (birthday-anchored rows) → Tasks 2 (mapping) + 3 (buildLifeline/health buckets) + 4 (LifePage hover/tint/milestones). ✓
- Testing & delivery → Task 10. ✓

**Placeholder scan:** No TBD/TODO; each code step shows real code; manual-check steps name exact console/Setup actions. ✓

**Type consistency:** `localDateISO`/`todayISO` (Task 1) reused in 2/3/9; `lifeCell`/`lifeCellIndex`/`birthdayInYear` (Task 2) reused in 3/4; `anchorStartDate(state, todayISO, lastResolved)` (Task 6) signature matches its tests; `recordCheckIn(dateISO)` + `canLogYesterday(todayISO)` (Task 7) match Task 8's call sites; `CheckIn` prop names (`canLogYesterday`, `onCompleteYesterday`) consistent between Tasks 8's App wiring and component. ✓

**Note for implementer:** if `testkit.ts` lacks `toBeCloseTo`, assert numeric closeness with `Math.abs(actual - expected) < 1e-6`. Verify no remaining importers of `weekSundayISO`/`weekIndex` after Task 4 (`grep -rn "weekSundayISO\|weekIndex" src`); drop or keep with a comment accordingly.
