# Polis

> Your city, your self. A personal, browser-based habit tool where a city is a
> living portrait of your holistic wellbeing.

Tend your habits and the city grows, sprawls, and gleams. Neglect or sabotage
yourself and districts fade, crumble, or burn.

## Status & roadmap

Fully working personal tool. Detailed design docs and implementation plans live in
`docs/superpowers/specs/` and `docs/superpowers/plans/` (one per milestone).

**Done**

- [x] **Simulation engine** — District → Borough (optional) → Landmark hierarchy;
  weighted good/bad habits; weighted health roll-up; entropy; unbounded maturity that
  unlocks organic features; sticky landmark tiers. Pure TypeScript, no UI deps.
- [x] **Persistence** — localStorage, JSON export/import, versioned save migrations.
- [x] **Profile page** — the one place to author content: identity (name, birthday,
  lifespan), districts and boroughs (add/rename), the habit catalog
  (create/rename/reweight/remove with a two-day removal cooldown), the landmark
  builder + manager (create/rename/remove), and milestones. Every other page is
  read-only.
- [x] **City page** — read-only "spreadsheet" view plus the daily check-in (the one
  logging interaction); district cards show health, maturity, features, and landmarks.
- [x] **Life page** — read-only: Eras banner (life stage from age), life-in-weeks grid
  with per-week date tooltips, birthday-week markers, and user milestones.
- [x] **Hex City Map (Stage 2)** — unified SVG hex city derived from the view model;
  color shows condition, with hover detail.
- [x] **Delivery** — zero-install static build (esbuild → committed bundle, runs from
  `file://`), tests on Node's built-in runner, private GitHub repo.

**Planned / ideas**

- [ ] **Stage 3 visuals** — real tile art for the hex map (e.g. a per-tile image
  layer); richer decay overlays / light animation (fire, weeds).
- [ ] **Rubble tiles** so a fully-decayed (0-building) district still shows on the map
  instead of disappearing.
- [ ] **Replace placeholder content** — swap the placeholder districts/boroughs/habits
  for the real wellbeing framework (virtues / PERMA / …). Content only, no code change.
- [ ] **Tune constants** in `src/engine/settings.ts` by feel during real use.
- [ ] **Remove the temporary `DevPanel`** (time-travel) before any "real" release.
- [ ] **Later, maybe** — borough regions drawn on the map; era-driven city restyling;
  landmark removal cooldown; cross-device sync (backend); graded/intensity habits;
  backfill of missed days.

## Architecture & features

- **Engine** (`src/engine/`) — a pure-TypeScript simulation. Three-level hierarchy:
  **District → Borough (optional) → Landmark**, with binary good/bad **habits**
  (each weighted) targeting any level. Per-node health/condition scalars evolve by
  momentum + entropy + sticky landmark tiers. Lower levels **roll up** into the
  district's health, weighted by how many habits/landmarks sit under each
  contributor. Districts accrue unbounded **maturity** while healthy, which adds
  legacy buildings (no cap) and unlocks organic **features** (fountain → park →
  library → …). Habit removal has a **two-day cooldown**. No UI/DOM/render deps.
- **Catalog** (`src/data/catalog.ts`) — the human-editable source of the default
  districts, boroughs, and habits (name, kind, weight, target).
- **View model** (`src/engine/viewModel.ts`) — the renderer seam. The UI consumes
  only this serializable read-only model, so a richer-art renderer (Stage 3) can
  replace the current views without touching the engine.
- **Persistence** (`src/persistence/`) — localStorage + JSON export/import +
  elapsed-day catch-up. A `version` field re-seeds on incompatible saves.
- **Hex City Map (Map tab)** — a unified hex-tile view of the city, derived from the
  view model (`src/engine/cityscape.ts`, pure). Each hex is a building, districts are
  neighborhood patches, color shows condition, features/landmarks are marked, and a
  hover tooltip gives detail. SVG, no new dependency.
- **Eras + Life page** — a city-level `profile` (name + birthday + lifespan) drives an
  **Era** (Age-of-Empires-flavored life stage from `src/data/eras.ts`, derived from
  age) shown as a banner. A **Life** tab renders life as a grid of weeks
  (52/row, 5-year gaps; grey = lived, green = now, white = future) with labeled era
  bands. Each box has a date tooltip (its week's Sunday); the first box of each row
  is ringed as the birthday week. **Milestones** (wedding, a child's birthday, a
  move…) highlight their week in violet. The Life tab is read-only; birthday,
  lifespan, and milestones are edited on the Profile tab. Pure math in
  `src/engine/lifeline.ts`.
- **Profile** (`src/ui/ProfilePage.tsx`) — the single authoring surface: identity
  (name, birthday, lifespan), districts and boroughs (add/rename), the habit catalog
  (create/rename/reweight/remove with cooldown), the landmark builder + manager
  (create/rename/remove — a removed landmark's habits re-home to its parent area), and
  milestones. All other tabs only display what's set here.
- **UI** (`src/ui/`) — React "spreadsheet city": read-only district cards (health,
  maturity, feature badges, uncapped neighborhood chips, borough sub-blocks,
  landmarks) plus the daily **check-in** on the City tab, the hex **Map**, the
  read-only **Life** grid, and the **Profile** authoring tab. A temporary `DevPanel`
  time-travels days for tuning (clearly marked; remove before release).

## Run it

**Zero install — just open it.** The built bundle is committed, so:

```bash
open public/index.html      # macOS; or double-click the file in any OS
```

It's a self-contained static page (one HTML + one JS + one CSS file). No server, no
install, works offline. State saves to your browser's localStorage; use
Export/Import to back up or move between machines.

**To develop / re-build** (only needs Node):

```bash
npm install      # react, react-dom, esbuild — the only external deps
npm test         # engine + persistence + lifeline suite (Node's built-in runner)
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
