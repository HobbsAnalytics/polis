# Spec B — Habit cadence (the "upkeep" model)

> Give every habit a regularity (daily / weekdays / weekly / twice-monthly /
> monthly) and make the city's health respond to cadence: completing a habit
> *maintains* its building for its period, and once that upkeep lapses the
> building *weathers* gently until it's tended again.

Status: **approved design** (2026-06-26). Builds on Spec A
(`2026-06-25-timekeeping-lifegrid-design.md`), which must be merged to `main`
first. This spec bumps `CITY_VERSION` 7 → 8.

---

## Background — the model today

- Every node loses a baseline `entropyPerDay` (0.01) each day.
- Each **good** habit is expected **every day**: completing it adds
  `goodHabitGain (0.06) × weight`; not completing costs
  `missedHabitPenalty (0.03) × weight` (or `missedCheckinPenalty 0.008` if the
  user didn't check in at all).
- **Bad** habits cost `badHabitPenalty × weight` only on days they're logged.
- There is **no cadence** — a weekly habit is treated as "missed" on its 6
  off-days. This is the bug this spec fixes.

The engine is a per-day snapshot chain (`advanceDay` → `applyCheckIn` /
`applyMissedDay`); `habitDelta`/`updateScalar` compute per-node deltas from the
set of completed/logged habit ids each day.

---

## 1. Data model

- **`Habit.cadence`** — new field:
  `'daily' | 'weekdays' | 'weekly' | 'twiceMonthly' | 'monthly'`.
  Period in days: `daily=1`, `weekly=7`, `twiceMonthly=15`, `monthly=30`.
  **`weekdays`** is the calendar special case: due each **Mon–Fri**; weekends
  are neutral (no upkeep decay, no overdue accrual).
- **`Habit.lastCompletedISO?`** — the date the habit was last completed (good
  habits). Drives days-since, due/overdue status, and upkeep. Stored on the
  habit so it rides the snapshot chain.
- Cadence is a **good-habit** concept. Bad habits carry no cadence (see §4).

### Migration (CITY_VERSION 7 → 8)

- Existing habits default `cadence: 'daily'` — preserves today's behavior
  exactly for anyone mid-stream.
- Back-fill `lastCompletedISO`: the most recent day-log date whose
  `completedHabitIds` includes the habit; else the habit's `createdAtISO`.
- **New-habit grace:** a freshly created habit is *maintained for its first
  period* from `createdAtISO` (anchor `lastCompletedISO = createdAtISO`), so it
  is never "born overdue."

---

## 2. Engine math — the upkeep model (heart)

`habitDelta` / `updateScalar` become cadence-aware: they additionally take
`today` (ISO) and read each habit's `lastCompletedISO`. The clock is still only
read via `todayISO()` at the call site (Spec A invariant); the engine stays
pure on the dates passed in.

Per **good** habit targeting a node, its daily contribution is one of:

- **Completed today** → an upkeep **deposit** (gain). The day's positive.
- **Maintained** — `daysSince(lastCompletedISO, today) ≤ periodDays` — → a
  gentle daily **upkeep positive**, so one action keeps the building crisp for
  the whole period. No nagging.
- **Overdue** — `daysSince > periodDays` — → a gentle daily **erosion** that
  **grows with overdue time** (e.g. scales with days-overdue, capped), much
  smaller than a daily habit's miss today.

All effects scale by `weight × cadenceEmphasis(cadence)` where:

- **`cadenceEmphasis ≈ sqrt(periodDays)` capped at ~3×.** So monthly
  (`√30 ≈ 5.5 → capped 3×`) lands ~2–3× a daily habit of equal weight — never
  30×. Exact base constants + cap tuned during the build.

`weekdays`: treat as `periodDays = 1` but **skip weekends** — on Sat/Sun the
habit neither requires action nor accrues overdue; Monday resumes from Friday.

Baseline `entropyPerDay` is unchanged and still applies to every node.

### New `Settings` tunables (defaults set + tuned in build)

- `upkeepDailyGain` — the maintained daily positive (per weight·emphasis).
- `overdueErosionBase` — the per-day overdue erosion (per weight·emphasis),
  plus a growth factor and cap for prolonged neglect.
- `cadenceEmphasisCap` — the ~3× ceiling.
- Existing `goodHabitGain` is repurposed as / replaced by the completion
  **deposit**; `missedHabitPenalty` / `missedCheckinPenalty` semantics are
  superseded by the maintained/overdue branches (kept for `daily` equivalence).

> Tuning goal: a `daily` habit at weight 1 should behave essentially as it does
> today; longer cadences should feel "tend it once, stays healthy, slowly
> patinas if ignored."

---

## 3. Check-in UX — status-grouped, all visible

The check-in modal lists **good** habits sorted into three groups:

1. **Overdue** (top)
2. **Due today**
3. **Maintained** — greyed, each labelled `✓ maintained · due in N days`

Every habit is tickable on any day; ticking a **maintained** habit early just
refreshes its upkeep. Ticking stamps `lastCompletedISO` to the **check-in's
date**, so this composes with Spec A's **"Log yesterday"** — logging yesterday
stamps yesterday, today stays open.

Status + "due in N days" are derived purely from `lastCompletedISO` + cadence +
the check-in date (a small shared helper, unit-tested).

---

## 4. Bad habits

Unchanged in spirit. A bad habit costs `badHabitPenalty × weight` on days it's
logged. Cadence is a schedule-to-keep (good-habit) concept, so bad habits show
**no cadence** in the editor and appear in their own check-in group. No new
mechanic — keeps scope tight.

---

## 5. Profile editor

The habit create/edit row gains a **cadence dropdown** (5 options, default
**Daily**) for good habits; hidden/disabled for bad habits. Weight, target,
kind, and removal cooldown are unchanged. Styled to the Patina tokens.

---

## 6. Map / visuals

**No new visual work.** Overdue erosion lowers a node's health, which already
weathers the building via the Patina health ramp — a freshly tended building
stays crisp and slowly patinas as it comes due. (Optional future: a small
"due" pip on the map; explicitly out of scope here.)

---

## 7. Verify & ship

TDD throughout:

- cadence → periodDays mapping incl. `weekdays` weekend-skip;
- `daysSince` / due / overdue status helper (boundary cases: exactly at period,
  one day over);
- the three good-habit branches (deposit / maintained / overdue-growing);
- `cadenceEmphasis = sqrt(period)` with the ~3× cap;
- migration: default `daily`, `lastCompletedISO` back-fill from log else
  `createdAtISO`, new-habit grace;
- check-in stamping incl. **log-yesterday** composition (stamps yesterday);
- `daily`-equivalence regression: a daily/weight-1 habit behaves as before.

Full suite green + clean build + headless smoke (create habits of each cadence;
verify check-in grouping + "due in N days"; verify migration of an existing
v7 save defaults to daily and preserves health). Review on **localhost**, then
deploy to `main`. No screenshots gathered for review — user reviews in-app.

### Constraints honored

- Only `todayISO()` reads the wall clock; engine stays pure on passed-in dates.
- Persistence key names unchanged; `CITY_VERSION` 7 → 8 with migration.
- Patina visual system unchanged (cadence dropdown + check-in groups styled to
  existing tokens; no restyle).

### Out of scope

- Custom "every N days" cadence (could add later).
- Map "due" pip / extra cadence visuals.
- The deferred Spec-A minor (ProfilePage milestone `weekIndex` boundary) —
  unrelated; leave for a cleanup pass.
