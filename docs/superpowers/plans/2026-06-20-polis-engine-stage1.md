# Polis — Engine + Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-TS wellbeing-simulation engine and a playable "spreadsheet city" React UI (Stage 1) that runs entirely in the browser with localStorage persistence.

**Architecture:** A pure TypeScript engine module (no UI/render deps) holds all state and rules and emits a serializable read-only **view model**. A React + Tailwind UI consumes only that view model. The view model is the seam that lets a future PixiJS renderer plug in unchanged.

**Tech Stack:** TypeScript, Vite, React 18, Tailwind v4, Vitest. (PixiJS deferred to Stage 2.)

## Global Constraints

- Engine module (`src/engine/**`) has **zero** imports from React, the DOM, or PixiJS.
- All engine update functions are **pure and deterministic** — no wall-clock reads, no randomness. Calendar→day mapping lives in the UI/persistence layer.
- Habits are **binary**. No backfill, no backend, no sync.
- Neglect gradient (tunable weights): missed check-in < missed habit < logged bad habit.
- "Think in weeks not days" — default tuning so one missed day is noise, ~3 neglected weeks clearly shows.
- Districts/habits ship as **placeholder content**, swappable as data without code changes.

---

## File Structure

```
polis/
  package.json, vite.config.ts, tsconfig.json, index.html, src/index.css, src/main.tsx
  src/engine/
    types.ts        # data model + view model types
    settings.ts     # tuning constants (default Settings)
    engine.ts       # createCity, applyCheckIn, applyMissedDay, addLandmark, addHabit
    viewModel.ts    # buildCityViewModel + condition/health labels
    seed.ts         # placeholder districts/habits/landmark
    engine.test.ts  # engine unit tests
    viewModel.test.ts
  src/persistence/
    storage.ts      # save/load localStorage, export/import JSON, elapsed-day catch-up
    storage.test.ts
  src/ui/
    App.tsx, CheckIn.tsx, CityView.tsx, DistrictCard.tsx, NewLandmark.tsx
```

---

### Task 1: Project scaffold + Vitest

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/index.css`, `src/ui/App.tsx`.

- [ ] Scaffold Vite React-TS project, add Tailwind v4 (`@tailwindcss/vite`), Vitest.
- [ ] `vite.config.ts` registers `@vitejs/plugin-react`, `@tailwindcss/vite`, and a `test` block (environment `node` for engine, `jsdom` for storage).
- [ ] Add npm scripts: `dev`, `build`, `test`, `test:run`.
- [ ] Smoke test `src/engine/smoke.test.ts`: `expect(1+1).toBe(2)`. Run `npm run test:run` → PASS.
- [ ] Commit.

### Task 2: Engine types (`types.ts`)

**Produces:** `HabitKind`, `TargetRef`, `Habit`, `District`, `Landmark`, `DayRecord`, `Settings`, `CityState`, and view-model types `ConditionLabel`, `GenericBuildingVM`, `LandmarkVM`, `DistrictVM`, `CityViewModel`.

```ts
export type HabitKind = 'good' | 'bad';
export type TargetRef =
  | { kind: 'district'; districtId: string }
  | { kind: 'landmark'; landmarkId: string };
export interface Habit { id: string; name: string; kind: HabitKind; target: TargetRef; }
export interface District { id: string; name: string; description: string; health: number; } // 0..1
export interface Landmark { id: string; districtId: string; name: string; condition: number; tier: number; tierProgress: number; createdDay: number; }
export interface DayRecord { day: number; checkedIn: boolean; completedHabitIds: string[]; loggedBadHabitIds: string[]; }
export interface Settings {
  windowDays: number; entropyPerDay: number; goodHabitGain: number;
  missedHabitPenalty: number; missedCheckinPenalty: number; badHabitPenalty: number;
  tierUpThreshold: number; daysToTier: number; maxGenericBuildings: number;
}
export interface CityState { day: number; settings: Settings; districts: District[]; landmarks: Landmark[]; habits: Habit[]; history: DayRecord[]; }
// view model
export type ConditionLabel = 'pristine' | 'worn' | 'crumbling' | 'on fire' | 'ruin';
export interface GenericBuildingVM { condition: number; label: ConditionLabel; }
export interface LandmarkVM { id: string; name: string; condition: number; label: ConditionLabel; tier: number; }
export interface DistrictVM { id: string; name: string; description: string; health: number; generic: GenericBuildingVM[]; landmarks: LandmarkVM[]; }
export interface CityViewModel { day: number; districts: DistrictVM[]; }
```
- [ ] Write the file. `npm run test:run` still green. Commit.

### Task 3: Settings defaults (`settings.ts`)

**Consumes:** `Settings`. **Produces:** `DEFAULT_SETTINGS`.

```ts
import type { Settings } from './types';
export const DEFAULT_SETTINGS: Settings = {
  windowDays: 14, entropyPerDay: 0.01, goodHabitGain: 0.06,
  missedHabitPenalty: 0.03, missedCheckinPenalty: 0.008, badHabitPenalty: 0.12,
  tierUpThreshold: 0.85, daysToTier: 14, maxGenericBuildings: 12,
};
```
- [ ] Write + commit.

### Task 4: Engine core (`engine.ts`) — TDD

**Consumes:** all of `types.ts`, `DEFAULT_SETTINGS`.
**Produces:**
- `createCity(opts?: { settings?: Settings; districts?: District[]; landmarks?: Landmark[]; habits?: Habit[] }): CityState`
- `clamp01(n: number): number`
- `updateScalar(current: number, goods: Habit[], bads: Habit[], completed: Set<string>, logged: Set<string>, checkedIn: boolean, s: Settings): number`
- `applyCheckIn(state: CityState, input: { completedHabitIds: string[]; loggedBadHabitIds: string[] }): CityState`
- `applyMissedDay(state: CityState): CityState`
- `addHabit(state, habit): CityState`, `addLandmark(state, { districtId, name }): { state: CityState; landmarkId: string }`

Update rule per scalar (district health or landmark condition), applied once per day:
```
delta = -entropyPerDay
for g in goods: completed.has(g.id) ? delta += goodHabitGain
                                    : delta -= (checkedIn ? missedHabitPenalty : missedCheckinPenalty)
for b in bads:  if logged.has(b.id) delta -= badHabitPenalty
return clamp01(current + delta)
```
`applyCheckIn` increments `day`, updates every district (its district-targeted habits) and every landmark (its landmark-targeted habits) via `updateScalar`, advances landmark tiers (condition≥tierUpThreshold ⇒ tierProgress++, else tierProgress=max(0,tierProgress-1); tierProgress≥daysToTier ⇒ tier++, tierProgress=0; tier never decreases), appends a `DayRecord{checkedIn:true}`. `applyMissedDay` is the same with empty sets and `checkedIn:false`. All functions return **new** state (no mutation).

- [ ] **Step 1 — failing tests** (`engine.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { createCity, applyCheckIn, applyMissedDay, addLandmark, addHabit } from './engine';
import type { District, Habit } from './types';

const d: District = { id: 'd1', name: 'D', description: '', health: 0.5 };

it('good habit raises landmark condition; missing it lowers slightly', () => {
  let s = createCity({ districts: [d] });
  const { state, landmarkId } = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = addHabit(state, { id: 'h1', name: 'do', kind: 'good', target: { kind: 'landmark', landmarkId } });
  const before = s.landmarks[0].condition;
  const up = applyCheckIn(s, { completedHabitIds: ['h1'], loggedBadHabitIds: [] });
  expect(up.landmarks[0].condition).toBeGreaterThan(before);
  const down = applyCheckIn(s, { completedHabitIds: [], loggedBadHabitIds: [] });
  expect(down.landmarks[0].condition).toBeLessThan(before);
});

it('neglect gradient: bad habit > missed habit > missed checkin', () => {
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' }); s = r.state;
  s = addHabit(s, { id: 'g', name: 'g', kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  s = addHabit(s, { id: 'b', name: 'b', kind: 'bad', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  const start = 0.8; s.landmarks[0].condition = start;
  const badHit = start - applyCheckIn(s, { completedHabitIds: ['g'], loggedBadHabitIds: ['b'] }).landmarks[0].condition;
  const missHabit = start - applyCheckIn(s, { completedHabitIds: [], loggedBadHabitIds: [] }).landmarks[0].condition;
  const missCheckin = start - applyMissedDay(s).landmarks[0].condition;
  expect(badHit).toBeGreaterThan(missHabit);
  expect(missHabit).toBeGreaterThan(missCheckin);
});

it('one missed day is small, three weeks is large (weeks not days)', () => {
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' }); s = r.state;
  s = addHabit(s, { id: 'g', name: 'g', kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  s.landmarks[0].condition = 1;
  const oneDay = 1 - applyMissedDay(s).landmarks[0].condition;
  let t = s; for (let i = 0; i < 21; i++) t = applyMissedDay(t);
  expect(oneDay).toBeLessThan(0.05);
  expect(1 - t.landmarks[0].condition).toBeGreaterThan(0.3);
});

it('condition clamps to [0,1] and state is not mutated', () => {
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' }); s = r.state;
  s.landmarks[0].condition = 0.01;
  let t = s; for (let i = 0; i < 10; i++) t = applyMissedDay(t);
  expect(t.landmarks[0].condition).toBeGreaterThanOrEqual(0);
  expect(s.landmarks[0].condition).toBe(0.01); // original unchanged
  expect(t.day).toBe(s.day + 10);
});

it('sustained high condition raises tier (sticky)', () => {
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' }); s = r.state;
  s = addHabit(s, { id: 'g', name: 'g', kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  s.landmarks[0].condition = 1;
  let t = s; for (let i = 0; i < 14; i++) t = applyCheckIn(t, { completedHabitIds: ['g'], loggedBadHabitIds: [] });
  expect(t.landmarks[0].tier).toBeGreaterThanOrEqual(1);
});
```
- [ ] **Step 2** Run `npx vitest run src/engine/engine.test.ts` → FAIL (module not found).
- [ ] **Step 3** Implement `engine.ts` per the rules above.
- [ ] **Step 4** Run tests → PASS. **Step 5** Commit.

### Task 5: View model (`viewModel.ts`) — TDD

**Consumes:** `CityState`, view-model types. **Produces:** `conditionLabel(c: number): ConditionLabel`, `buildCityViewModel(state: CityState): CityViewModel`.

Labels by threshold: `>=0.8 pristine`, `>=0.55 worn`, `>=0.3 crumbling`, `>=0.1 on fire`, else `ruin`.
Generic buildings per district: `count = max(1, round(health * maxGenericBuildings))` when health>0 else 0; each generic VM uses `condition = health`.

- [ ] **Step 1 — failing tests** (`viewModel.test.ts`): assert label boundaries; assert a district at health 1 yields `maxGenericBuildings` generic VMs and at health 0 yields 0; assert landmark VM carries tier and label.
- [ ] **Step 2** Run → FAIL. **Step 3** Implement. **Step 4** Run → PASS. **Step 5** Commit.

### Task 6: Seed content (`seed.ts`)

**Consumes:** `createCity`, `addLandmark`, `addHabit`. **Produces:** `createSeededCity(): CityState`.

Placeholder content: 3 districts ("District One/Two/Three", placeholder descriptions), one landmark in district one ("Placeholder Landmark"), 2 good + 1 bad placeholder habits across district and landmark targets. Districts start at `health: 0.5`, landmark at `condition: 0.5`.
- [ ] Quick test: `createSeededCity()` returns 3 districts, ≥1 landmark, ≥3 habits. Run → PASS. Commit.

### Task 7: Persistence (`storage.ts`) — TDD (jsdom)

**Consumes:** `CityState`, `createSeededCity`, `applyMissedDay`. **Produces:**
- `saveCity(state: CityState): void` / `loadCity(): CityState | null` (key `polis.city`)
- `exportCity(state: CityState): string` (pretty JSON) / `importCity(json: string): CityState` (parse + shape check, throws on bad input)
- `catchUpMissedDays(state: CityState, elapsedDays: number): CityState` (applies `applyMissedDay` `elapsedDays` times; 0 ⇒ unchanged)

- [ ] **Step 1 — failing tests** (`storage.test.ts`, jsdom env): save→load round-trips; export→import round-trips deep-equal; `importCity('not json')` throws; `catchUpMissedDays(s, 3).day === s.day + 3`.
- [ ] **Step 2** FAIL. **Step 3** Implement. **Step 4** PASS. **Step 5** Commit.

### Task 8: UI shell + CityView (read-only render)

**Files:** `src/ui/App.tsx`, `CityView.tsx`, `DistrictCard.tsx`. **Consumes:** `buildCityViewModel`, persistence, seed.

- [ ] `App` loads city from storage (or seeds), on mount computes elapsed days from a stored `lastOpenedISO` date and calls `catchUpMissedDays`, holds `CityState` in React state, persists on every change.
- [ ] `CityView` maps `buildCityViewModel(state).districts` to `DistrictCard`s.
- [ ] `DistrictCard` shows district name, health bar, a row of generic-building chips colored by `label`, and landmark rows (name, tier, condition bar, label). Color map: pristine green, worn lime, crumbling amber, on fire orange, ruin red/gray.
- [ ] Manual check via `npm run dev`: seeded city renders. Commit.

### Task 9: Daily check-in UI (`CheckIn.tsx`)

**Consumes:** `applyCheckIn`, habits from state.
- [ ] Renders today's good habits as checkboxes and bad habits as "I did this" toggles, grouped by target. A "Complete check-in" button calls `applyCheckIn` with selected ids, persists, and visibly updates the city. Disable the button once checked in for the current `day` (track `lastCheckInDay`).
- [ ] Manual check: completing a check-in moves bars. Commit.

### Task 10: Landmark + habit creation UI (`NewLandmark.tsx`)

**Consumes:** `addLandmark`, `addHabit`.
- [ ] Form: pick district, name the landmark, add ≥1 good habit and optionally bad habits (each with name); on submit, `addLandmark` then `addHabit` for each, all targeting the new landmark; persist; new landmark appears in its district. (Enforces "a landmark requires its habits.")
- [ ] Export/Import buttons in `App`: Export downloads `exportCity(state)` as `polis-city.json`; Import reads a file and `importCity`s it. Commit.

### Task 11: Full suite + build

- [ ] `npm run test:run` → all PASS. `npm run build` → succeeds (tsc + vite). Fix any type errors. Commit.

---

## Self-Review

- **Spec coverage:** engine/renderer split (Tasks 2,5,8) ✓; three-level data model (Task 2) ✓; condition scalar + rolling/entropy/tier (Task 4) ✓; district health → generic count+condition (Tasks 4,5) ✓; good/bad habits + targets (Tasks 2,4) ✓; neglect gradient (Task 4) ✓; daily check-in (Task 9) ✓; landmark requires habits (Task 10) ✓; static + localStorage + JSON export/import (Tasks 7,10) ✓; placeholders (Task 6) ✓; weeks-not-days tuning (Tasks 3,4) ✓; renderer seam = view model (Task 5) ✓.
- **Placeholders:** none — all steps carry concrete code or commands.
- **Type consistency:** names (`updateScalar`, `applyCheckIn`, `applyMissedDay`, `buildCityViewModel`, `conditionLabel`, `catchUpMissedDays`, `createSeededCity`) used identically across tasks.
