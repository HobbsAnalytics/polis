# Spec C — In-the-moment check-in

**Date:** 2026-06-27
**Status:** Approved (design)
**Supersedes:** the bulk "Complete check-in" flow and the Spec A `canLogYesterday` button/gate.

## Problem

Three issues with the current nightly check-in:

1. **"Log yesterday" never appears in the common case.** The button is gated on
   `canLogYesterday = (lastResolved is ≥2 days before today) AND (not logged today)`.
   After a reset (or any single missed day) `lastResolved` is at most one day behind,
   so the ≥2-day gate is never crossed and yesterday is never offered. The `−2` grace
   window (meant to hold the last two days open) and this `>=2` gate combine into an
   off-by-one mismatch with the user's mental model ("yesterday is backfillable until I
   log today").
2. **The check-in is crowded** at 15–20 habits — one long list with no way to focus.
3. **No in-the-moment logging.** Everything is staged and submitted in bulk via
   "Complete check-in"; there is no way to log a single habit when you do it.

## Goal

Replace the bulk check-in with **instant per-habit logging**: ticking a habit's checkbox
logs it immediately for a selected day (at most once per day; unticking undoes it), with a
**Today / Yesterday** toggle and **per-district filter tabs**. This subsumes the
"log yesterday" fix (the toggle replaces the button) and de-crowds the panel (one district
at a time).

This is one connected redesign, scoped to a single plan.

## Design

### 1. Interaction model — the checkbox is the action

- Tick a good habit → logged for the selected day **instantly**: its upkeep deposit is
  applied to its target node and `lastCompletedISO` is stamped to that day.
- Untick → the log is removed and the effect reversed.
- A habit may be logged **at most once per day**, enforced by set membership in that day's
  `completedHabitIds`.
- Bad habits use the same instant model: tick = "I did this" for the selected day (applies
  `badHabitPenalty × weight`); untick undoes it. Logged in that day's `loggedBadHabitIds`.
- No "Complete check-in" button; no staged local `done`/`slipped` state.
- Feedback: because there is no submit, each row gives immediate visual confirmation — it
  settles into its new checked/unchecked state and its status chip updates
  (e.g. Overdue → Maintained · due in N).

### 2. Today / Yesterday toggle

- A two-state toggle at the top of the panel. **Today** is the default.
- **Yesterday** is a fully editable *draft* day: tick/untick any habit, stamped to
  yesterday. It stays editable for all of today and **rolls closed at the next local
  midnight**, when it ages out of the grace window and is committed. The rollover is
  realized by the existing resolve-on-load / focus-visibility re-resolve from Spec A (which
  commits aged-out draft days), **not** a live timer — when the local date advances, the old
  yesterday commits and the toggle's two states shift forward by one day.
- This *is* the grace window, made visible and directly editable. The Spec A
  `canLogYesterday` helper and the "Log these for yesterday instead" button are **removed**.

### 3. Layout — district filter tabs

- District tabs run along the top of the panel. Selecting a tab filters the list to **one
  district's** habits.
- Within a tab, good habits keep Spec B's status grouping: **Overdue → Due today →
  Maintained** (each with its chip: "overdue Nd" / "due today" / "✓ maintained · due in Nd").
  That district's bad habits appear in a **Slips** group at the bottom.
- Each tab carries an **urgency badge**: a count of that district's overdue + due-today good
  habits (hidden when zero). This keeps a single-district default from hiding urgent work
  elsewhere.
- **Default tab: attention-first.** On open, select the first district (in city order) that
  has any overdue or due-today habit; if none, the first district in city order.
- The toggle (§2) governs the whole panel; switching districts preserves the selected day.

### 4. Engine architecture — committed base + replay of draft days

Today the engine appends one resolved day per `advanceDay`. Instant, editable days require
re-deriving the recent days on each edit, so the model becomes **a committed base plus a
replay of draft days**:

- **Committed base** = the `snapshot` (already stored on every `DayLog`) of the last
  *locked* day — the most recent day that has aged out of the editable window.
- **Draft days** = today, and still-open yesterday. Each draft day's
  `completedHabitIds` / `loggedBadHabitIds` are editable sets.
- On any tick/untick: edit the relevant draft day's set, then **re-derive** the city by
  replaying the draft days in chronological order on top of the committed snapshot, using the
  existing `advanceDay`. Because replay starts from a clean snapshot, health clamping (0–1)
  reverses exactly — undo introduces no drift.
- On load, `loadResolvedCity` **commits** any draft day that has aged out of the window
  (folds it permanently into the base), generalizing today's `catchUpMissedDays` logic.
  Replay is idempotent; days never double-count.

The per-node math is unchanged — Spec B's `habitDelta` upkeep/maintained/overdue branches and
`cadenceEmphasis` are reused verbatim. What changes is *when and how often* a day is computed
(append-once → replay-on-edit), not the formula.

### 5. Removed / changed surface

- ❌ "Complete check-in" bulk button and the staged `done` / `slipped` `useState` in
  `CheckIn.tsx`.
- ❌ `canLogYesterday` (storage) and the "Log these for yesterday instead" button + helper
  text in `CheckIn.tsx`; the `onCompleteYesterday` path in `App.tsx`.
- 🔧 `CityMap` "Logged today ✓" CTA: "logged today" is no longer a single binary. The CTA
  becomes a neutral "Log / edit today" entry into the panel. (The panel keeps its current
  entry point; not inlined.)

### 6. Migration & compatibility

- **No `CITY_VERSION` bump.** `DayLog` already carries `completedHabitIds`,
  `loggedBadHabitIds`, and `snapshot`, which is everything replay needs.
- Existing saves (the migrated v8 city) replay correctly: the last logged day's snapshot is
  the committed base; the open window holds today (and yesterday if a day has passed).
- A freshly reset / brand-new city has an empty base with today as the only draft day, so the
  item-1 "born today" case simply shows **Today** with everything un-ticked and offers
  **Yesterday** once a calendar day has elapsed.
- The day counter shown in the header continues to derive from `startDateISO` (Spec A),
  independent of replay bookkeeping.

### 7. Bad habits

Bad habits have no cadence (a good-habit concept). They appear in the **Slips** group of their
target district's tab and follow the instant model in §1. No new mechanic.

## Testing

TDD throughout:

- Tick logs the habit for the selected day and applies its deposit; `lastCompletedISO` stamps
  to that day.
- Untick removes the log and reverses the effect exactly — including when the node was at a
  clamp boundary (0 or 1) during the draft.
- Once-per-day idempotence: re-ticking the same habit/day is a no-op beyond the first.
- Toggle edits the correct day (today vs yesterday) and switching districts preserves the day.
- Yesterday commits at the midnight rollover and is no longer editable afterward.
- **Regression guard:** replaying a sequence of draft days equals the old append-once path for
  the same inputs (same final health/snapshots).
- District tabs filter to the correct habits; urgency badges count overdue + due-today
  accurately; attention-first default selects the right tab.

Full suite green + clean build + headless smoke, then a localhost review before any deploy.

## Out of scope

- Wider backfill (a date stepper beyond yesterday) — the toggle is intentionally two-state.
- Any change to the Patina/weathering visuals or the cadence math from Spec B.
- A separate cross-city "Due" overview tab (district tabs + badges cover the need).
