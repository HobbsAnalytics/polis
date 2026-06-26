# Spec A — Timekeeping & Life grid

> Fix the day counter, the daily-check-in calendar reset, add "log yesterday"
> grace, and correct the Life-in-weeks birthday drift. All four items are
> calendar/clock work and ship together. (Habit cadence is Spec B, separate.)

## Background

Grounded in the current code (`src/engine/dates.ts`, `engine.ts`, `lifeline.ts`,
`src/persistence/storage.ts`, `src/ui/App.tsx`, `CheckIn.tsx`, `LifePage.tsx`):

- `cityDay(profile, todayISO)` returns `0` unless `profile.startDateISO` is set,
  and that field is only stamped at the instant a name first goes blank→set
  (`setProfile`). A named city whose stamp never fired stays frozen at Day 0.
- `todayISO()` returns the **UTC** date (`new Date().toISOString().slice(0,10)`).
  `canCheckIn = lastCheckIn !== todayISO()`. In timezones behind UTC, an evening
  check-in stamps tomorrow's UTC date, so "Logged today" sticks through the next
  local morning. A tab left open past midnight compounds it (no re-render).
- Missed days are resolved on load by `loadResolvedCity` →
  `catchUpMissedDays` → `applyMissedDay`, which **appends** a `DayLog` entry
  (entropy + missed check-in). The log is a snapshot chain; `DaySnapshot` stores
  only neighborhood + landmark health, so a past entry cannot be cheaply rewritten.
- The Life grid buckets weeks as fixed 7-day spans from birth
  (`weekIndex = floor(ms / MS_PER_WEEK)`). 52 weeks = 364 days vs a ~365.25-day
  year, so each row drifts ~1.25 days earlier per year. The "birthday" highlight
  is simply cell 0 of each row (`i === 0`), which is why its hover date wanders.

## Scope

In: items 1, 2, 3, 5 below. Out: habit cadence (Spec B). No visual restyle
beyond what these features require; the Patina design system is unchanged.

---

## Item 1 — Day counter anchored to first use

**Goal:** the header always shows "Day N" = calendar days since first use,
independent of whether the city is named. (Day 1 = first day.)

- `cityDay` depends only on `startDateISO`; it no longer matters whether `name`
  is set. Returns `max(0, dayDiff(startDateISO, today)) + 1` when anchored.
- New saves: stamp `startDateISO` at city creation (`createSeededCity` / the
  create path) with the **local** today, so a fresh user is Day 1 immediately.
- Existing saves (migration back-fill): if `startDateISO` is empty, set it to the
  best available signal, in order:
  1. the earliest non-empty `log[].dateISO`, else
  2. the `polis.lastResolved` localStorage marker, else
  3. local today.
  This is applied where the resolved city is loaded (it needs both the city blob
  and the device marker). Stamp is persisted so it's stable thereafter.
- Header: always render `${name ? name + "'s" : 'Your'} city · Day N`. Keep a
  gentle "name your city on the Profile tab" nudge **only** when the name is
  blank, but never gate the counter on the name.
- `setProfile`'s existing blank→set stamp stays as a no-op safety net (it won't
  fire once `startDateISO` is already anchored).

## Item 3 — Local calendar date

**Goal:** "Logged today" resets at local midnight, every calendar day.

- `todayISO()` builds the date from local components
  (`getFullYear`/`getMonth`+1/`getDate`, zero-padded) instead of the UTC ISO
  slice. All other date helpers keep parsing `YYYY-MM-DD` (their internal UTC
  arithmetic is self-consistent; only the wall-clock bridge changes).
- Tab-rollover: add a `visibilitychange` + `focus` listener in `App` that, when
  the local date differs from the date captured at last resolution, re-runs the
  resolve path (`loadResolvedCity(todayISO())`) and refreshes `lastCheckIn`, so a
  long-open tab flips at the new day without a manual reload.
- No timezone picker — the browser's local time is sufficient. (A Profile
  override remains a trivial future addition if ever needed; not in scope.)

## Item 2 — Log yesterday (grace window)

**Goal:** you can still credit yesterday until you log today — grace for
late-night habits.

- Resolution change: on load, auto-resolve missed days only for days **two or
  more** days old. The most recent past day ("yesterday") is **held open** — no
  missed entry is written for it yet. Concretely, `loadResolvedCity` resolves up
  to `today − 2` and leaves `today − 1` pending; if the user never acts, that day
  resolves as missed on a subsequent load once it is ≥2 days old.
- The append-only log is preserved: we never rewrite a chained entry. "Holding
  the slot open" replaces "write a missed entry now, edit it later."
- Check-in modal:
  - Primary action **"Log today"** (unchanged default).
  - When yesterday is still open, also show **"Log yesterday"**.
  - *Log yesterday* → `applyCheckIn` dated yesterday; today stays open. Intended
    to be done before logging today.
  - *Log today* → if yesterday is still open and was not logged, stamp it
    **missed** first (`applyMissedDay` dated yesterday) to preserve chronological
    order, then `applyCheckIn` dated today.
- "Log yesterday" is hidden/disabled once yesterday is resolved (logged or aged
  out) or once today has been logged. Net rule, surfaced in the UI copy:
  **log yesterday before today; logging today closes an unlogged yesterday as
  missed.**
- Bookkeeping: a "log yesterday" check-in updates the resolution marker to
  `today − 1` (not today) and does **not** set `lastCheckIn` to today (today is
  still open and `canCheckIn` must stay true). Define the markers precisely in
  the plan: `lastResolved` tracks the latest resolved day; `lastCheckIn` tracks
  the latest *checked-in* calendar day used by `canCheckIn`.

## Item 5 — Birthday-anchored Life rows

**Goal:** every row's highlighted box is the week of your birth month/day in that
year; hover dates stay anchored to the birthday across all rows.

- Each row `Y` (year of life) is anchored to your actual birthday in calendar
  year `birthYear + Y`. Row `Y` spans birthday(Y) → birthday(Y+1).
- 52 cells per row. **Cell 0 = the birthday week** (always the highlighted
  "birthday" box; hover shows that year's birthday date). Cells 1–51 step forward
  7 days each; the final cell (51) absorbs the ~1–2 leftover days so every row
  realigns to the birthday.
- New pure mapping `lifeCell(birthDateISO, dateISO) → { row, cell }` and a linear
  `lifeCellIndex = row * 52 + cell`. A date maps to its row by the calendar
  birthday it has most recently passed, and to a cell by
  `min(51, floor(daysSinceThatBirthday / 7))`.
- Replace the grid's use of `weekIndex` with `lifeCellIndex` for: week status
  (lived/current/future), health-tint bucketing (`weeklyHealthChange`), milestone
  placement, and the hover label (cell start date = birthday(row) + 7·cell).
- `age` = full calendar years since birth (standard), used for era selection.
  `weeksLived` for the summary stat = `completedRows * 52 + currentCell`.
- Edge cases (must be covered by tests): Feb-29 birthdays clamp to Feb 28 in
  non-leap years; year boundaries; a date before birth → no cell; lifespan cap.

---

## Testing & delivery

- **TDD** the pure math first:
  - local `todayISO()` (mock the clock; assert local, not UTC, components).
  - `startDateISO` back-fill inference (earliest log date → marker → today).
  - grace-window resolution (yesterday held open; ≥2-day-old days resolve;
    chronological order when logging today over an open yesterday).
  - `lifeCell` / `lifeCellIndex`: birthday on cell 0 every row, hover-date
    anchoring, leap-year clamp, year boundary, pre-birth, lifespan cap.
- Full suite green + clean `npm run build`.
- Headless smoke: Day N shows for a named city; simulate date rollover →
  "Logged today" flips to checkable; log-yesterday writes a dated entry and
  leaves today open; Life grid birthday boxes align to the birthday across rows.
- Behavior preserved elsewhere; v7 saves migrate safely (now also back-filling
  `startDateISO`). No change to export/import shape beyond the (already-present)
  `startDateISO` field beginning to carry a value.
- Review on localhost (no screenshots), then commit + push to `main`
  (origin = HobbsAnalytics/polis); GitHub Pages auto-deploys. Verify live.
