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

- **Committed base** = a **full `CityState`** through day `today−2` (the last *locked* day).
  This is the authoritative persisted city (`polis.city`). NOTE: the per-`DayLog`
  `DaySnapshot` is *partial* (neighborhood health + landmark condition only — no maturity,
  tiers, features, building list, or day counter), so it is **not** a valid replay base; it
  remains only for the read-only History view. Replay anchors on the full committed
  `CityState`.
- **Draft days** = today, and still-open yesterday — the 2-day open window. Each draft day's
  `completedHabitIds` / `loggedBadHabitIds` are editable sets, persisted in a new
  `polis.drafts` store: `Record<dateISO, { completedHabitIds: string[]; loggedBadHabitIds:
  string[] }>`.
- **Displayed city** = `replayDrafts(committedBase, openWindowDraftsInChronologicalOrder)`,
  where replay folds each draft day via the existing `applyCheckIn` / `advanceDay`. The
  engine is **fully deterministic — no RNG anywhere** (`entropyVariance(id)` is a stable
  per-building hash; verified no `Math.random` in `src/engine/`). So replaying from the full
  committed base reproduces health, sticky maturity/tiers/features, building growth, and the
  day counter **exactly**, and undo (remove from a draft set, then re-replay from the
  committed base) introduces **zero drift even at the 0–1 clamp boundaries**. Replay always
  starts from the committed base and is never applied on top of an already-replayed state.
- **Checkbox checked-state** for the selected day = the habit is in that day's draft set
  **OR** (good habit and `lastCompletedISO === selectedDay` in the committed base). Ticking
  adds the habit to the draft set and is **idempotent** — a no-op if the habit is already
  effectively logged for that day. This enforces once-per-day and, at the deploy seam (§6),
  prevents any double-count. Unticking removes it from the draft set and re-replays.
- On load, `loadResolvedCity` **commits** every calendar day that has aged past the window
  (after `lastResolved` and ≤ `today−2`): a day that has a draft commits with its inputs; a
  day with none commits as a missed day (today's `catchUpMissedDays` behavior). Committed
  drafts are removed and `lastResolved` advances to `today−2`. Today and yesterday remain
  editable drafts. The midnight rollover is the Spec A resolve-on-load / focus re-resolve
  running this same commit, shifting the toggle's two days forward.

The per-node math is unchanged — Spec B's `habitDelta` upkeep/maintained/overdue branches and
`cadenceEmphasis` are reused verbatim, as are `applyCheckIn` / `advanceDay`. What changes is
*when and how often* a day is computed (append-once → replay-on-edit) and what is persisted (a
committed base + a drafts store), not the formula.

### 5. Removed / changed surface

- ❌ "Complete check-in" bulk button and the staged `done` / `slipped` `useState` in
  `CheckIn.tsx`.
- ❌ `canLogYesterday` (storage) and the "Log these for yesterday instead" button + helper
  text in `CheckIn.tsx`; the `onCompleteYesterday` path in `App.tsx`.
- 🔧 `recordCheckIn` and the `handleCheckIn` / `handleCheckInYesterday` bulk handlers are
  replaced by draft-edit handlers (write `polis.drafts`, re-replay). `applyCheckIn` /
  `advanceDay` are **retained** — replay reuses them.
- 🔧 `CityMap` "Logged today ✓" CTA: "logged today" is no longer a single binary. The CTA
  becomes a neutral "Log / edit today" entry into the panel. (The panel keeps its current
  entry point; not inlined.)

### 6. Migration & compatibility

- **No `CITY_VERSION` bump** — the `CityState` shape is unchanged. The change is in the
  persistence *envelope* (a new `polis.drafts` localStorage key) and the *meaning* of
  `polis.city` (now the committed base rather than the displayed city).
- **First load under the new code:** the saved `polis.city` becomes the committed base as-is;
  `polis.drafts` is absent → treated as empty; `lastResolved` is set to **`today−1`** so
  **today is immediately editable** (yesterday is treated as already committed in the base).
  Joseph's freshly-reset city (empty history) therefore opens on **Today** with everything
  un-ticked and full editing, and offers **Yesterday** once a calendar day has elapsed — item
  1 fixed by construction.
- **Deploy-day seam (documented, benign):** for a user who had already checked in *today*
  under the old model, today's effect is already in the base; its checkbox shows checked (via
  the `lastCompletedISO === today` rule) and the once-per-day idempotence guard makes
  re-ticking a no-op — so there is **no double-count**. The only limitation is that such a
  pre-deploy "today" log cannot be unticked on that one day (it is already committed). This
  affects at most the single deploy day; no data is corrupted.
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
- **Replay determinism:** replaying the same drafts on the same committed base twice yields an
  identical city (health, maturity, tiers, building list, day) — and equals the old
  append-once path for the same inputs (regression guard).
- **Commit boundary on load:** days that have aged past the 2-day window commit (draft days
  with their inputs, dayless gaps as missed days), `lastResolved` advances to `today−2`, and
  today + yesterday remain editable drafts.
- **Checked-state union rule:** a good habit reads as checked for a day when it is in that
  day's draft set OR its committed `lastCompletedISO === selectedDay`.
- District tabs filter to the correct habits (mapping each habit through its target
  borough/landmark to a `districtId`); urgency badges count overdue + due-today accurately;
  attention-first default selects the right tab.

Full suite green + clean build + headless smoke, then a localhost review before any deploy.

## Out of scope

- Wider backfill (a date stepper beyond yesterday) — the toggle is intentionally two-state.
- Any change to the Patina/weathering visuals or the cadence math from Spec B.
- A separate cross-city "Due" overview tab (district tabs + badges cover the need).
