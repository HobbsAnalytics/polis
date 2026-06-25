# Map consolidation — spec + plan

> Remove the City page; redistribute its content onto the Map page. Design approved.
> Styling per `docs/design/design-system.md` (tokens/type/line; modal on limestone/paper).
> Behavior preserved otherwise. TDD any moved logic; verify with build + headless smoke + screenshots.

## Spec (what changes)

1. **Shell/nav.** Delete the City page. Nav = **Map · Life · History · Profile** (+ Export/Import).
   `Page` type drops `'city'`; default `page` state = `'map'`.
2. **Era banner.** Currently global (above all pages). Render it **only** at the top of the Map page.
3. **DevPanel.** Delete `DevPanel.tsx`, the `AdvanceMode` type, and `handleAdvance`/`handleReset`
   wiring (+ now-unused imports: `applyMissedDay`, `createSeededCity`, `resetResolution`,
   `addDaysISO`). Keep the real-calendar day resolution (`loadResolvedCity`) intact.
4. **Daily check-in → modal.** The Map rail gains a **"Log today"** CTA that opens a centered
   **modal** wrapping the existing `CheckIn` (restyled). Submit reuses `handleCheckIn`, closes the
   modal, city updates behind it. Disabled "Logged today" state when `lastCheckIn === today`.
   Modal floor: scrim, focus-trap, **Esc** to close, focus returns to the trigger, respects
   `prefers-reduced-motion`.
5. **Map detail panel → click-to-inspect** (bottom of Map):
   - **Hover** keeps the existing preview (fade others + reveal name) — unchanged.
   - **Rail row click = district level:** panel shows district health (+ maturity/features note if
     present) and its boroughs + direct landmarks, each with a health bar and the habits connected
     (name, good/bad, weight).
   - **Map tile click = borough level:** panel narrows to that borough — its health, its landmarks,
     and the attached habits.
   - **At rest:** one-line hint "Select a district or borough to see its health and the habits
     connected to it." A small **clear** (and clicking empty map space) deselects.
   - Selected set gets a persistent full-ink outline + name so it's clear what's inspected.

## Architecture

- **No engine/data change.** Habits already carry `target {kind:'borough'|'landmark', id}`. The panel
  reads them via the existing, tested `habitsTargeting(habits, kind, id)` from `rollup.ts`.
- **`CityMap`** owns the map + rail + legend + **detail panel** + hover/selection state. New props:
  `habits: Habit[]` (for the panel), optional `onLogToday?: () => void` + `canCheckIn?: boolean`
  (rail CTA renders only when `onLogToday` is given — so History's read-only map has no CTA).
- **`DistrictCard.tsx`** refactored into reusable detail pieces (`ConditionBar`, `HabitLine`,
  `LandmarkDetail`, `BoroughDetail`) + a `MapDetailPanel`. **`CityView.tsx` deleted.**
- **`HistoryPage`** drops `CityView`; renders the read-only `CityMap` (snapshot vm + `city.habits`),
  no `onLogToday`.
- **Modal** is a small reusable accessible component (`Modal.tsx`): scrim, focus-trap, Esc, restore
  focus to `document.activeElement` captured at open, reduced-motion-aware. Open state + the
  `CheckIn` wrapper live in `App` (overlay at app root); the rail CTA calls `onLogToday`.

## Phases

**Phase A — nav / banner / devpanel removal.**
Drop `'city'` from `Page`; default `'map'`; remove the City tab + `CityView`/`DevPanel`/dev wiring +
unused imports; move the era banner to render only when `page==='map'`; update `HistoryPage` to the
read-only `CityMap`; delete `CityView.tsx` and `DevPanel.tsx`. (Thread `habits` into `CityMap` as a
prop now, rendered minimally, so History compiles.) Verify: suite green, clean build.

**Phase B — check-in modal.**
Add `Modal.tsx` (a11y per floor). Add the rail "Log today" CTA (disabled when already logged). App
holds `checkInOpen`; renders `<Modal>` wrapping `CheckIn` with `onComplete = handleCheckIn + close`.
Verify: suite green, clean build, smoke (open/submit/Esc/disabled).

**Phase C — map detail panel (click-to-inspect).**
Refactor `DistrictCard.tsx` → detail pieces + `MapDetailPanel`. Add `selection` state to `CityMap`
(rail click → district, tile click → borough, clear → none) + persistent outline; render the panel
under the map. Verify: suite green, clean build, smoke + screenshots of every required behavior.

## TDD note

The only "logic that moves" is habit surfacing, which reuses the already-tested `habitsTargeting`.
No new engine functions are anticipated; if any pure helper is added, it gets a failing test first.
UI has no unit-test harness in this repo (engine/persistence only), so UI is verified by the
headless smoke + screenshots, consistent with prior phases. Full suite must stay green throughout.

## Verify before deploy (then STOP)

Full suite green; clean build; headless smoke + screenshots: Map is default with the banner on top;
"Log today" opens the modal and a check-in applies; rail-click a district fills the panel; tile-click
a borough narrows it; the City tab and DevPanel are gone. Do not push until approved.
