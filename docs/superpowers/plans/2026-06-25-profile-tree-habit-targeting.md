# Profile tree + habit re-targeting + v7 migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:test-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Narrow habit targets to borough|landmark, make landmarks/boroughs mandatory under a borough, migrate live saves to v7, and rebuild the Profile page as a District › Borough › Landmark accordion with inline authoring + Add Habit.

**Architecture:** Pure engine changes (types + a few functions), one new migration step in storage, then a Profile-page UI rewrite folding the old catalog/landmark panels into a tree. Engine stays UI-free; rollup is untouched.

**Tech Stack:** TypeScript, React 18, esbuild bundle, Node built-in test runner via `src/testkit.ts`. Tests: `npm test`. Build: `npm run build`.

## Global Constraints

- `node --test` strips types (no typecheck); keep TS strict-clean anyway.
- Delete no user data in the migration — re-parent only, preserve ids/health/log.
- Keep v2→v6 migrations working; add v6→v7.
- Importance weights: Somewhat important / Important / Very important = 1 / 2 / 3.
- Reuse existing engine functions and handlers; don't restructure rollup.

---

## Phase A — Engine + migration (PAUSE for review when green)

### Task A1: Narrow habit target type; landmark boroughId required

**Files:** Modify `src/engine/types.ts`

- [ ] Add `export type HabitTargetKind = 'borough' | 'landmark';`, change `TargetRef.kind` to `HabitTargetKind`. Keep `NodeKind` as-is.
- [ ] Change `Landmark.boroughId: string | null` → `boroughId: string`.
- [ ] Update doc comment on `District.healthDirect` to "fallback only; no habit feeds it".

### Task A2: addDistrict auto-creates a "General" borough

**Files:** Modify `src/engine/engine.ts`, Test `src/engine/engine.test.ts`

- [ ] **Failing test** in engine.test.ts:

```ts
it('addDistrict auto-creates a General starter borough', () => {
  let s = createCity();
  const r = addDistrict(s, { name: 'Health' });
  s = r.state;
  expect(s.districts).toHaveLength(1);
  const generals = s.boroughs.filter((b) => b.districtId === r.districtId);
  expect(generals).toHaveLength(1);
  expect(generals[0].name).toBe('General');
  expect(r.boroughId).toBe(generals[0].id);
  // buildings live under the borough, not directly on the district
  expect(s.neighborhoods.filter((n) => n.districtId === r.districtId && n.boroughId === null)).toHaveLength(0);
  expect(s.neighborhoods.filter((n) => n.boroughId === generals[0].id).length).toBeGreaterThan(0);
});
```

- [ ] Run → fails (no `boroughId` on result / borough not created).
- [ ] Implement: `addDistrict` builds the district with **no** seeded neighborhoods, then calls `addBorough(next, { districtId, name: 'General' })`; return `{ state, districtId, boroughId }`.
- [ ] Run → passes. Adjust the existing `addDistrict / renameDistrict` test only if it asserts borough/neighborhood counts (it doesn't).

### Task A3: addLandmark requires a borough; removeLandmark re-homes to it

**Files:** Modify `src/engine/engine.ts`, Test `src/engine/engine.test.ts`

- [ ] **Failing test**: a landmark created under a borough, when removed, re-homes its habit to that borough (already covered by existing `removeLandmark deletes it and re-homes its habits to the parent`). Add:

```ts
it('addLandmark attaches under the given borough', () => {
  let s = createCity({ districts: [dist('d1')], boroughs: [{ id: 'b1', districtId: 'd1', name: 'B', healthDirect: 0.5 }] });
  const r = addLandmark(s, { districtId: 'd1', boroughId: 'b1', name: 'L' });
  expect(r.state.landmarks[0].boroughId).toBe('b1');
});
```

- [ ] Implement: `addLandmark` opts `boroughId: string` (required). `removeLandmark` target is always `{ kind: 'borough', id: lm.boroughId }`; drop the district branch.
- [ ] Delete the now-invalid `removeLandmark re-homes to the district when there is no borough` test (district-direct landmarks no longer exist).
- [ ] Run → green.

### Task A4: advanceDay stops feeding district.healthDirect

**Files:** Modify `src/engine/engine.ts`, Test `src/engine/engine.test.ts`

- [ ] **Failing test**:

```ts
it('district healthDirect no longer decays (no habit targets a district)', () => {
  let s = createCity({ districts: [dist('d1', 0.5)] });
  const before = s.districts[0].healthDirect;
  for (let i = 0; i < 10; i++) s = applyMissedDay(s);
  expect(s.districts[0].healthDirect).toBe(before);
});
```

- [ ] Run → fails (currently decays via entropy).
- [ ] Implement: remove the `districtsHD = state.districts.map(... upd 'district' ...)` line; build `next` with `districts: state.districts`; keep the subsequent maturity/feature map.
- [ ] Run → green. Confirm the `maturity accrues / rolls up` tests still pass (they target landmarks/boroughs or read districtHealth).

### Task A5: v6 → v7 migration

**Files:** Modify `src/engine/settings.ts` (CITY_VERSION → 7), `src/persistence/storage.ts`, Test `src/persistence/storage.test.ts`

- [ ] Bump `CITY_VERSION = 7`.
- [ ] **Failing tests** in storage.test.ts (build a v6 city with a borough-less district holding a district-direct habit, a null-borough landmark, and null-borough neighborhoods):

```ts
it('migrates v6 → v7: back-fills General and re-homes district-direct items', () => {
  const s = createCity({
    districts: [dist('d1', 0.5)],
    boroughs: [],
    landmarks: [{ id: 'lm1', districtId: 'd1', boroughId: null, name: 'L', condition: 0.5, tier: 0, tierProgress: 0, createdDay: 0 }],
    neighborhoods: [{ id: 'nb1', districtId: 'd1', boroughId: null, health: 0.5, createdDay: 0 }],
    habits: [hab('h1', 'good', { kind: 'district', id: 'd1' })],
  });
  saveCity({ ...s, version: 6 } as unknown as typeof s);
  const loaded = loadCity()!;
  expect(loaded.version).toBe(7);
  const gen = loaded.boroughs.find((b) => b.districtId === 'd1' && b.name === 'General')!;
  expect(gen).toBeTruthy();
  expect(loaded.habits[0].target).toEqual({ kind: 'borough', id: gen.id });
  expect(loaded.landmarks[0].boroughId).toBe(gen.id);
  expect(loaded.neighborhoods.find((n) => n.id === 'nb1')!.boroughId).toBe(gen.id);
  // nothing deleted
  expect(loaded.habits).toHaveLength(1);
  expect(loaded.landmarks).toHaveLength(1);
  expect(loaded.neighborhoods.find((n) => n.id === 'nb1')).toBeTruthy();
});

it('v6 → v7 re-homes district-direct items into an existing first borough', () => {
  const s = createCity({
    districts: [dist('d1')],
    boroughs: [{ id: 'b-existing', districtId: 'd1', name: 'Sleep', healthDirect: 0.5 }],
    habits: [hab('h1', 'good', { kind: 'district', id: 'd1' })],
  });
  saveCity({ ...s, version: 6 } as unknown as typeof s);
  const loaded = loadCity()!;
  expect(loaded.boroughs.filter((b) => b.districtId === 'd1')).toHaveLength(1); // no new General
  expect(loaded.habits[0].target).toEqual({ kind: 'borough', id: 'b-existing' });
});
```

(Add `dist`/`hab` helpers or import from a shared spot; storage.test currently uses `createSeededCity` — add small local factories mirroring engine.test.)

- [ ] Run → fails (no v7 step).
- [ ] Implement a `migrateV6toV7(o)` helper called from `migrate` when `o.version === 6`: iterate districts; ensure a borough (create `borough-<id>-general` if none); pick first borough as home; map habits/landmarks/neighborhoods as specified; set `version: 7`.
- [ ] Update the existing v2/v3/v4 migration assertions: `version` expectations 6 → 7.
- [ ] Run → green.

### Task A6: Seed + catalog + downstream test fixups

**Files:** Test `src/engine/seed.test.ts`, Modify `src/data/catalog.ts`

- [ ] Update seed.test.ts: a seeded city now has a "Home" district **and** one "General" borough under it; assert `boroughs` length 1 / name 'General' / `districtId === 'district-1'`. Keep habits/landmarks length 0.
- [ ] Retarget catalog.ts sample habits off `kind:'district'` (point the district ones at `b1`) so the file stays type-valid; make `SEED_LANDMARK.boroughId` a plain `string`.
- [ ] Run full suite → all green. **PAUSE and report results.**

---

## Phase B — Profile tree UI + Add Habit (after pause)

### Task B1: App wiring for required boroughId

**Files:** Modify `src/ui/App.tsx`

- [ ] Change `handleCreateLandmark(districtId, boroughId: string, name)`; call `addLandmark(city, { districtId, boroughId, name })`.
- [ ] Leave other handlers; `handleAddDistrict` keeps ignoring the returned boroughId.

### Task B2: Profile accordion tree

**Files:** Modify `src/ui/ProfilePage.tsx` (fold in HabitCatalog/NewLandmark logic), reuse importance select.

- [ ] Keep `IdentitySection` and `MilestonesSection`.
- [ ] Replace `DistrictsSection`/`BoroughsSection`/`HabitCatalog`/`NewLandmark`/`LandmarksManager` with a `CityTree` that renders District → Borough → Landmark with expand/collapse (local `useState<Set<string>>` of open ids), inline rename inputs, add controls at each level, and **+ Add Habit** on borough and landmark rows.
- [ ] Extract a shared `ImportanceSelect` (move from HabitCatalog into ProfilePage or a small shared module) and a `HabitRow` (rename + reweight + remove/cooldown) reused under boroughs and landmarks.
- [ ] **+ Add Habit** opens an inline form (name, kind, importance) and calls `onCreateHabit({ name, kind, weight, target: { kind, id } })` with `kind:'borough'|'landmark'`.
- [ ] **+ Add Landmark** appears only under a borough; calls `onCreateLandmark(districtId, boroughId, name)`.
- [ ] New-district add control creates the district (engine adds General borough).
- [ ] Remove `HabitCatalog`/`NewLandmark` imports from ProfilePage; delete the components if unused elsewhere (they aren't).

### Task B3: Verify

- [ ] `npm test` → full suite green.
- [ ] `npm run build` → clean bundle into `public/app.js`.
- [ ] Headless smoke (playwright MCP against served `public/`): expand/collapse a district/borough; add a habit on a borough and on a landmark; add a new district and confirm a "General" borough appears under it. Capture a screenshot.
- [ ] **STOP and report before deploying.** Do not push.
