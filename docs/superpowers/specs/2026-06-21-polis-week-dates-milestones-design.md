# Polis — Week hover dates + Milestones

**Date:** 2026-06-21
**Status:** Approved; builds on the Eras/Life-in-Weeks page.

Two additions to the Life page: a hover tooltip giving each week box's date, and
user-defined "milestones" (important life dates) highlighted on the grid.

## 1. Week hover dates

Pure helper in `src/engine/lifeline.ts`:
```ts
weekSundayISO(birthDateISO: string, index: number): string
```
- `weekStart = birthDate + index * 7 days`; return the Sunday within that 7-day
  span (`weekStart + ((7 - weekStartDow) % 7)` days), as a `YYYY-MM-DD` string.
  Computed in UTC to avoid timezone drift.

UI: a small `formatDate(iso)` helper renders "Sun, Jun 16 2024". Every box gets a
`title`: `"Week of {formatted}"`. The birthday box (col 0) appends
`" · Birthday (age {year})"`; a box with milestones appends `" · {labels}"`.

Note: weeks are anchored to the birthday's weekday, so the "Sunday" is the Sunday
falling within that birthday-anchored week.

## 2. Milestones

State:
```ts
interface Milestone { id: string; label: string; dateISO: string; }
// CityState gains: milestones: Milestone[]
```
`CITY_VERSION` 3 → 4. `migrate` backfills `milestones: []` for v3 saves.

Engine (pure):
```ts
addMilestone(state, { label, dateISO }): CityState   // id via caller (crypto.randomUUID in UI)
removeMilestone(state, id): CityState
```
(`addMilestone` takes a full `Milestone` incl. id, mirroring `addHabit`.)

Mapping (UI, using existing week math): `weekIndex = weeksLived(birthDateISO,
dateISO)` → `floor((date − birth)/7)`. A milestone is "on the chart" if
`0 <= weekIndex < totalWeeks`. Build a `Map<number, Milestone[]>` for cell lookup.

Highlight: a box with ≥1 milestone gets the `life-milestone` class — a violet fill
+ ring overriding the lived/current/future color — and its labels in the tooltip.

UI (Life page "Milestones" panel):
- Add form: label (text) + date (date input) → `addMilestone` with a generated id.
- List: each milestone shows label + formatted date + Remove (immediate, no
  cooldown). Off-the-chart milestones (before birth / past lifespan) are listed
  with an "(off the chart)" note and don't highlight a box.

## Scope

Milestones only highlight weeks on the Life page; they do not affect districts,
habits, or city health. No cooldown on removal.

## Testing

`lifeline.test.ts`: `weekSundayISO` returns a Sunday and the right date for a known
birth/index. `engine.test.ts`: add/removeMilestone. `storage.test.ts`: v3→v4
migration backfills `milestones: []`. Then verify tooltips + milestone highlight +
add/remove in a real browser.
