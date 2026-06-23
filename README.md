# Polis

> Your city, your self. A personal, browser-based habit tool where a city is a
> living portrait of your holistic wellbeing.

## Vision

Most habit trackers reduce your life to streaks and checkboxes. Polis turns it
into a **place**. Each area of your wellbeing — health, family, work, rest — is a
**district** in a small city you tend over a lifetime. The habits you keep are the
upkeep: do the work and neighborhoods grow, mature, and unlock landmarks and
amenities; neglect or sabotage yourself and buildings fade, crumble, and burn.

The city is meant to be **lived in, not gamed**. There are no points to chase and
no leaderboard — just an honest, at-a-glance portrait of how the different parts of
your life are actually doing. Because every building has its own health, a district
reads as a real patchwork: one block thriving while another quietly decays, the way
life actually is. A calendar-anchored clock means a day in your city is a day in
your life, and the Life-in-weeks view zooms all the way out so you can see months
and years of effort at a glance. An activity log records every day's changes, so you
can step back through your city's history and watch the story of your own
consistency unfold.

It's deliberately small, private, and yours: a self-contained page that runs offline
in your browser, with no account, no server, and no one watching but you.

## Status & roadmap

Fully working personal tool. Detailed design docs and implementation plans live in
`docs/superpowers/specs/` and `docs/superpowers/plans/` (one per milestone).

**Done**

- [x] **Simulation engine** — District → Borough (optional) → Neighborhood / Landmark
  hierarchy; weighted good/bad habits; weighted health roll-up; per-building entropy
  variance so identical habits still diverge; unbounded maturity that grows legacy
  buildings and unlocks organic features; sticky landmark tiers. Pure TypeScript, no
  UI deps.
- [x] **Per-neighborhood health** — every building is a persistent entity with its own
  health that drifts individually, so a district is a patchwork (some blocks pristine,
  others crumbling). District/borough health is a weighted roll-up of its buildings,
  boroughs, and landmarks.
- [x] **Calendar-anchored day counter** — the city's day count is anchored to the real
  calendar from the day you name your city; each real-world day advances it by one.
- [x] **Persistence** — localStorage, JSON export/import, versioned save migrations.
- [x] **Daily activity log + History view** — every advanced day appends a compact log
  record (net health change + a snapshot); a read-only **History** tab steps back
  through past days and re-renders the City and Map as they stood.
- [x] **Profile page** — the one place to author content: identity (name, birthday,
  lifespan), districts and boroughs (add/rename), the habit catalog
  (create/rename/re-prioritize/remove with a two-day removal cooldown), the landmark
  builder + manager (create/rename/remove), and milestones. Every other page is
  read-only.
- [x] **City page** — read-only "spreadsheet" view plus the daily check-in (the one
  logging interaction); district cards show health, maturity, features, per-building
  neighborhood chips, borough sub-blocks, and landmarks.
- [x] **Life page** — read-only: Eras banner (life stage from age), life-in-weeks grid
  with per-week date tooltips, birthday-week markers, user milestones, and weeks
  **tinted by the city's net health change** that week (thrived → declined).
- [x] **Hex City Map** — one contiguous, roughly-circular hex city derived from the
  view model; districts are contiguous regions, **boroughs are outlined sections**
  within them, each hex is a single building colored by its own condition, with hover
  detail.
- [x] **Delivery** — zero-install static build (esbuild → committed bundle, runs from
  `file://`), deployed to GitHub Pages off `main`; tests on Node's built-in runner.

**Planned / ideas**

- [ ] **Stage 3 visuals** — real tile art for the hex map (e.g. a per-tile image
  layer); richer decay overlays / light animation (fire, weeds).
- [ ] **Replace placeholder content** — swap the placeholder districts/boroughs/habits
  for the real wellbeing framework (virtues / PERMA / …). Content only, no code change.
- [ ] **Tune constants** in `src/engine/settings.ts` by feel during real use.
- [ ] **Remove the temporary `DevPanel`** (time-travel) before any "real" release.
- [ ] **Map label placement** — keep a district label from overlapping a borough label
  when one district's region wraps toward the center.
- [ ] **Later, maybe** — era-driven city restyling; cross-device sync (backend);
  graded/intensity habits; backfill of missed days.

## Architecture & features

- **Engine** (`src/engine/`) — a pure-TypeScript simulation. Hierarchy:
  **District → Borough (optional) → Neighborhood / Landmark**, with binary good/bad
  **habits** (each weighted by importance) targeting any level. Each **neighborhood**
  is a persistent building with its own 0..1 health that evolves by habit-driven gain
  + a per-building entropy variance (derived deterministically from its id, so
  identical habits still produce a varied skyline). Lower levels **roll up** into the
  district's health, weighted by how many buildings/landmarks sit under each
  contributor. Districts accrue unbounded **maturity** while healthy, which grows
  legacy buildings (no cap) and unlocks organic **features** (fountain → park →
  library → …). Habit removal has a **two-day cooldown**. No UI/DOM/render deps.
- **Neighborhoods** (`src/engine/neighborhoods.ts`) — the per-building model: seeding,
  legacy growth, and the individual daily drift with entropy variance.
- **Activity log + history** (`src/engine/history.ts`) — each advanced day appends a
  `DayLog` (net health change + a compact snapshot of every building/landmark);
  `cityAtSnapshot` overlays a snapshot onto the current city to reconstruct a past day
  read-only for the History view.
- **Catalog** (`src/data/catalog.ts`) — the human-editable source of the default
  districts, boroughs, and habits (name, kind, weight, target).
- **View model** (`src/engine/viewModel.ts`) — the renderer seam. The UI consumes
  only this serializable read-only model, so a richer-art renderer (Stage 3) can
  replace the current views without touching the engine.
- **Persistence** (`src/persistence/`) — localStorage + JSON export/import +
  elapsed-day catch-up (dated, so caught-up days land in the right week). A `version`
  field migrates older saves (e.g. v5→v6 seeds per-building neighborhoods and the
  activity log in place).
- **Hex City Map (Map tab)** — one contiguous hex city derived from the view model
  (`src/engine/cityscape.ts`, pure). The whole city is a single roughly-circular disc
  carved into contiguous district regions; boroughs take outlined sub-regions within
  their district; each hex is one building colored by its own condition, with
  features/landmarks marked and a hover tooltip. SVG, no new dependency.
- **Eras + Life page** — a city-level `profile` (name + birthday + lifespan) drives an
  **Era** (Age-of-Empires-flavored life stage from `src/data/eras.ts`, derived from
  age) shown as a banner. A **Life** tab renders life as a grid of weeks
  (52/row, 5-year gaps; grey = lived, green = now, white = future) with labeled era
  bands. Each box has a date tooltip (its week's Sunday); the first box of each row is
  ringed as the birthday week; **milestones** highlight their week in violet; and each
  lived week is tinted by the **net health change** the city saw that week (from the
  activity log), so months and years of consistency read at a glance. Pure math in
  `src/engine/lifeline.ts`.
- **Profile** (`src/ui/ProfilePage.tsx`) — the single authoring surface: identity
  (name, birthday, lifespan), districts and boroughs (add/rename), the habit catalog
  (create/rename/re-prioritize/remove with cooldown), the landmark builder + manager
  (create/rename/remove — a removed landmark's habits re-home to its parent area), and
  milestones. Habit importance is a simple dropdown — **Somewhat important /
  Important / Very important** (weight 1 / 2 / 3). All other tabs only display what's
  set here.
- **UI** (`src/ui/`) — React "spreadsheet city": read-only district cards (health,
  maturity, feature badges, per-building neighborhood chips, borough sub-blocks,
  landmarks) plus the daily **check-in** on the City tab, the hex **Map**, the
  read-only **Life** grid, the read-only **History** stepper, and the **Profile**
  authoring tab. A temporary `DevPanel` time-travels days for tuning (clearly marked;
  it dates its simulated days so the log and week-colors populate — remove before
  release).

## Run it

**Zero install — just open it.** The built bundle is committed, so:

```bash
open public/index.html      # macOS; or double-click the file in any OS
```

It's a self-contained static page (one HTML + one JS + one CSS file). No server, no
install, works offline. State saves to your browser's localStorage; use
Export/Import to back up or move between machines. It's also deployed to GitHub Pages
at **https://hobbsanalytics.github.io/polis/**.

**To develop / re-build** (only needs Node):

```bash
npm install      # react, react-dom, esbuild — the only external deps
npm test         # engine + persistence + lifeline + history suite (Node's built-in runner)
npm run dev      # live-reload dev server (esbuild) at http://localhost:8000
npm run build    # rebuild public/app.js (commit it so the zero-install path stays current)
```

The engine (`src/engine`) is pure TypeScript with **no UI/DOM/React imports**, so you
can build on it and replace the front end freely; the React UI reads only the
serializable view model it emits.

## Toolchain note (why not Vite/Vitest?)

The original plan specified Vite + Vitest. In this environment the configured npm
registry (`npm-proxy.dev.databricks.com`) **cannot serve `vite`'s package
metadata** (persistent 502) and intermittently 404s on parts of the Tailwind
dependency tree. To stay unblocked the toolchain was pivoted to zero-/low-install:

- **Tests** run on **Node's built-in test runner** (`node --test`) using Node 25's
  native TypeScript type-stripping — no test framework install at all.
  `src/testkit.ts` is a tiny Vitest-compatible shim (`it`/`expect`/`beforeEach`)
  plus an in-memory `localStorage`.
- **Build/dev** use **esbuild** (no Vite). Styling is hand-written plain CSS
  (`public/app.css`) rather than Tailwind.

Because of Node's native TS resolution, relative imports inside `src/engine` and
`src/persistence` use explicit `.ts` extensions. If a working registry becomes
available, swapping back to Vite + Vitest + Tailwind is straightforward.
