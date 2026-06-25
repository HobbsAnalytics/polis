# Profile authoring tree + habit re-targeting + v7 migration — design

Date: 2026-06-25
Status: Approved

Two user-facing Profile changes, the supporting data-model change, and a
storage migration. The map page, borough outlines, and per-neighborhood decay
are **out of scope**.

## 1. Data model (`engine/types.ts`)

- **Habit targets narrow to borough | landmark.** A habit can no longer target a
  district.

  ```ts
  export type HabitTargetKind = 'borough' | 'landmark';
  export interface TargetRef { kind: HabitTargetKind; id: string; }
  ```

  `NodeKind = 'district' | 'borough' | 'landmark'` is **kept** for rollup
  addressing (`habitsTargeting`, the per-node scalar updates). Only what a
  *habit* may point at narrows.

- **`Landmark.boroughId` becomes required** (`string`, never `null`). Landmarks
  always live under a borough.

- **`Neighborhood.boroughId` stays `string | null`.** Maturity-growth still
  accrues district-direct buildings; that path is out of scope. The migration
  re-homes only the *existing* null ones.

- **Boroughs are mandatory:** every district has ≥1 borough at all times. Enforced
  by `addDistrict` (auto-creates "General") and the migration (back-fills
  "General").

- **`District.healthDirect` is retired as a habit sink.** Nothing targets a
  district directly, so no habit feeds it and it no longer decays. It survives
  only as the rollup's empty-container fallback (kept for safety; in practice a
  district always has a borough now). District health stays a pure roll-up of its
  boroughs + their neighborhoods + landmarks — `rollup.ts` is unchanged.

## 2. Engine (`engine/engine.ts`, `engine/seed.ts`)

- **`addDistrict`** creates the district **and** a starter borough named
  "General", and returns `{ state, districtId, boroughId }`. The district seeds
  **no** direct neighborhoods; the General borough seeds them (via the existing
  `addBorough`, which calls `neighborhoodsForBorough`). This mirrors the
  migration's end state: every building lives under a borough.

- **`addLandmark`** requires `boroughId: string` (drops the `null` default).

- **`removeLandmark`** always re-homes its habits to the landmark's borough
  (a landmark always has one now). The old district-fallback branch is removed.

- **`advanceDay`** no longer runs the per-district `healthDirect` update
  (`upd(..., 'district', ...)`); districts pass through unchanged before the
  maturity/feature recompute, which still reads `districtHealth`. Borough and
  landmark scalar updates are unchanged. The neighborhood district-container
  delta is left in place (now always 0 — harmless, future-proof).

- **`createSeededCity`** is unchanged in code (still `addDistrict(createCity(),
  {name:'Home'})`) but now yields a "Home" district **with** a "General" borough.

## 3. Migration (`persistence/storage.ts` → v7)

`CITY_VERSION` 6 → 7. v2→v6 steps stay intact; **v6→v7** is new. **Deletes
nothing** — re-parents one level down, preserving all ids, health, and history.

For each district:

1. If it has **no borough**, create one named "General" with a stable, collision-
   free id `borough-<districtId>-general` and `healthDirect` 0.5.
2. Let `homeBorough` = the district's first borough (the just-created General if
   step 1 ran, else the pre-existing first borough).
3. Re-home everything parented directly to the district into `homeBorough`:
   - habits with `target.kind === 'district'` and `target.id === districtId` →
     `{ kind: 'borough', id: homeBorough.id }`
   - landmarks with `districtId === d.id` and `boroughId === null` →
     `boroughId = homeBorough.id`
   - neighborhoods with `districtId === d.id` and `boroughId === null` →
     `boroughId = homeBorough.id`

Neighborhood/landmark ids are **kept** (entropy variance and history snapshots
stay stable). New borough ids never collide with the engine's `borough-N`
scheme.

## 4. Profile page (`ui/ProfilePage.tsx`) — collapsible tree

Replace the flat sections with a nested expand/collapse tree **District ›
Borough › Landmark**. The standalone "Habit catalog", "Raise a landmark", and
"Manage landmarks" panels are **folded into the tree** — no separate blocks.
Identity and Important-dates sections stay.

Per-level inline controls:

- **District:** add (auto-creates a "General" borough), rename, edit description.
- **Borough:** add (under a district), rename. Has **+ Add Habit** and **+ Add
  Landmark**.
- **Landmark:** add (only under a borough), rename, remove. Has **+ Add Habit**.

**Add Habit** (on a borough row → `{kind:'borough', id}`; on a landmark row →
`{kind:'landmark', id}`) reuses the existing fields: name, good/bad kind, and the
importance dropdown (Somewhat important / Important / Very important = 1/2/3).

Existing habits render inline under their borough/landmark with rename, reweight
(importance dropdown), and the existing remove + cooldown-confirm flow.

## 5. Wiring (`ui/App.tsx`)

- `handleCreateLandmark(districtId, boroughId, name)` — `boroughId` now required.
- `handleAddDistrict` ignores the new returned `boroughId` (engine handles it).
- Remaining handlers (`addHabit`, `updateHabit`, rename/remove, removal
  cooldown, add/rename borough/district) are reused unchanged.
- `HabitCatalog.tsx` / `NewLandmark.tsx` standalone components are retired from
  the page; their logic moves into the tree.

## Out of scope

Hex Map page / borough outlines; per-neighborhood decay behavior.

## Implementation order

types → engine (addDistrict/addLandmark/removeLandmark/advanceDay) → migration →
**[PAUSE: engine + migration tests green]** → Profile tree UI + Add Habit →
verify (suite, build, headless smoke).
