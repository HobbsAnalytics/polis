# Polis — Design Spec

**Date:** 2026-06-20
**Status:** Approved design; scope = Engine + Stage 1
**Working title:** Polis (your city = your self)

---

## 1. Purpose

A personal, browser-based habit tool in which a **city is a living portrait of the
user's holistic wellbeing**. Tending to good habits makes the city grow, sprawl, and
gleam. Neglect or self-sabotage makes districts fade, crumble, or burn.

The tool exists to be **motivating at a glance**: open the browser, see a sprawling
prosperous city and feel good; see one district on fire and immediately know where
you're sabotaging yourself. It is a personal tool for the author, not a product —
optimize for "useful and motivating," not for strangers or virality.

## 2. Guiding Principles

- **Engine and renderer are strictly separate.** This is the single most important
  architectural rule. The simulation is the durable asset; visuals are layered on top
  and may be upgraded repeatedly without touching the brain.
- **Think in weeks, not days.** Time constants should feel like weeks. One missed day
  is noise; three neglected weeks clearly shows. "Character isn't grown or broken in a
  day." Entropy is the resting state — untended things slowly decay.
- **Every monument means something.** Landmark buildings correspond to real, named
  aspirations or struggles, created only by committing to specific habits.
- **Low logging friction.** A personal habit tool lives or dies on how little effort it
  takes to record the day. One daily check-in is the ritual.
- **Frameworks are content, not code.** The engine holds *any* set of districts and
  habits. The author seeds the actual districts/habits as data and can swap them later
  (virtues vs. PERMA vs. Plato vs. Freud) without code changes. Ship with placeholders.

## 3. Architecture

### 3.1 The one rule

- **Engine** — a pure TypeScript module. Knows districts, buildings, habits, time, and
  the rules that evolve them. **Zero UI, zero rendering dependencies.** Fully
  unit-testable. Could run in a terminal.
- **Renderer** — a *view* of engine state.
  - Stage 1: React + Tailwind cards/bars (text + color).
  - Stage 2/3: PixiJS canvas (top-down → isometric), using free pre-made art.
  - Swapping renderers never touches the engine.

### 3.2 The renderer seam (designed now, used later)

The engine exposes a serializable, read-only **view model** describing the full city
state (districts, buildings, conditions, tiers, counts). Any renderer consumes this
view model and renders it; renderers never reach into engine internals. Stage 1's React
UI and Stage 2's PixiJS canvas both consume the same view model. This is the contract
that lets Stage 2 "plug in."

### 3.3 Delivery

- **Static web app, no server.** Runs entirely in the browser.
- **Persistence:** `localStorage`, with one-click **JSON export / import** for backup
  and moving between machines. Per-device only for now.
- **Stack:** TypeScript throughout; **React + Vite + Tailwind** UI shell; engine as a
  standalone pure TS module; **PixiJS** introduced at Stage 2.
- Out of scope now: backend, cross-device sync, auth.

## 4. Data Model — three levels

### 4.1 District

A wellbeing domain — the "philosophy layer." A neighborhood of the city. Examples
(placeholders to be finalized as content): the classical virtues
(Fortitude/Temperance/Justice/Prudence), or PERMA, or Plato's spirit/reason/appetite.
Ships with placeholder districts.

A district has:
- identity (id, name, description)
- an **aggregate health** value derived from its buildings/habits
- a collection of buildings

### 4.2 Building

Two kinds:

- **Generic building** — ambient filler that reflects the district's *overall* health.
  Not tied to a sub-category. District aggregate health controls both their **count**
  (sprawl/abandonment) and their **condition**. These are the at-a-glance "is this
  neighborhood thriving or fading" signal.
- **Named / landmark building** — a specific, committed goal (e.g. *Sobriety*). Bigger,
  more impressive, **earned**. Created only by committing to a sub-category and
  attaching the good/bad habits that feed and threaten it. Every landmark maps to a real
  named struggle or aspiration.

Every building has a single **condition** scalar (see §5).

### 4.3 Habit

A **binary** daily action (done / not-done). Good or bad. Attached to a target:
- a specific building (generic or landmark), or
- a whole district.

Bad habits declare what they damage (a landmark they're wired to, or a whole district).

## 5. State Mechanics

### 5.1 Building condition

Each building has one **condition** scalar with visual thresholds:

```
pristine → worn → crumbling → on fire → ruin
```

Condition is driven by the combination of:

- **Rolling window** of recent habit performance for that building's habits — gradual,
  forgiving day-to-day movement (the core "momentum" feel).
- **Entropy** — a slow constant downward pressure; the resting state of anything
  untended is decay.
- **Cumulative tier** — accumulated good stretches let a building permanently level up
  (size/tier), so the city genuinely sprawls and grows over months. Tier is "sticky";
  condition is the day-to-day surface state.

### 5.2 District aggregate health

Derived from the district's habits/buildings. Controls **generic buildings' count and
condition**: thriving districts grow new generic buildings outward; dying districts lose
them to abandonment.

### 5.3 Good vs. bad habits

- **Good habit done** → feeds its target (raises condition / contributes to tier).
- **Bad habit logged** → pushes condition **down faster** than neglect, against its
  declared target (specific landmark or whole district).

### 5.4 Neglect gradient

Not all neglect is equal. Tunable weights, smallest to largest impact:

1. **Missed check-in** (didn't open/log at all) — *small* impact.
2. **Missed habit** (checked in, but didn't do a specific habit) — *medium* impact.
3. **Logged bad habit** — *large* impact.

All weights are tunable engine parameters.

## 6. Logging Loop

A once-a-day **check-in**:

1. Open the app.
2. Run down the checklist of habits; mark each done / not-done.
3. Submit; the city updates and the user sees it react.

Binary habits only for now. **No backfill** initially (may be added later). Missing a
check-in counts as the small-impact neglect above.

## 7. Creating a Landmark

To create a landmark building, the user must define the sub-category and attach its
habits (the good habits that feed it and the bad habits that threaten it). A landmark
cannot exist without its habits — this guarantees every monument corresponds to a real
commitment.

## 8. Build Stages (same engine throughout)

1. **Stage 1 — "Spreadsheet city" (THIS SPEC).** Engine + a plain React/Tailwind UI
   showing districts and buildings as cards/bars with condition in text + color. Daily
   check-in works. Persistence (localStorage + JSON export/import) works. Fully
   playable; proves the loop and the math feel right.
2. **Stage 2 — "Readable map" (future).** A 2D top-down canvas (PixiJS) using free
   pre-made art (e.g. Kenney.nl city tile packs). Buildings as tiles; condition swaps
   the tile. Consumes the same view model.
3. **Stage 3 — "Real city" (future).** Isometric PixiJS view: depth, nicer layout,
   animated fire/smoke, sprawl. Visual craft handled via the `frontend-design` skill.

## 9. Scope

### In scope (Engine + Stage 1)

- Pure TS engine: data model (§4), state mechanics (§5), time advancement, neglect
  gradient, landmark creation, view-model output.
- Engine unit tests for the core rules (rolling window, entropy, tier, neglect
  gradient, bad-habit damage).
- React + Vite + Tailwind Stage 1 UI consuming the view model: district/building cards,
  condition display, daily check-in flow, habit/landmark creation UI.
- Persistence: localStorage save/load + JSON export/import.
- Placeholder districts/habits seeded as content.

### Out of scope (for now)

- Backend, cross-device sync, auth.
- Graded / intensity habits (binary only).
- Backfill of missed days.
- The actual PixiJS visuals (Stage 2/3).
- Finalizing the philosophical framework for districts (ships with placeholders;
  finalized later as content).

## 10. Open Questions / Deferred Decisions

- Exact tuning constants (window length, entropy rate, tier thresholds, neglect
  weights) — start with reasonable defaults, tune by feel during use.
- Final district framework — deferred; placeholders for now.
