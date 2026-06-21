# Polis

> Your city, your self. A personal, browser-based habit tool where a city is a
> living portrait of your holistic wellbeing.

Tend your habits and the city grows, sprawls, and gleams. Neglect or sabotage
yourself and districts fade, crumble, or burn. See `docs/superpowers/specs/` for
the full design.

## Status: Phase 1 + v2 (engine + "spreadsheet city")

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
  only this serializable read-only model, so a future PixiJS renderer (Stage 2/3)
  can replace the React cards without touching the engine.
- **Persistence** (`src/persistence/`) — localStorage + JSON export/import +
  elapsed-day catch-up. A `version` field re-seeds on incompatible saves.
- **Eras + Life page** — a city-level `profile` (birthday + lifespan) drives an
  **Era** (Age-of-Empires-flavored life stage from `src/data/eras.ts`, derived from
  age) shown as a banner. A second **Life** tab renders life as a grid of weeks
  (52/row, 5-year gaps; grey = lived, green = now, white = future) with labeled era
  bands. Each box has a date tooltip (its week's Sunday); the first box of each row
  is ringed as the birthday week. Users can add **milestones** (wedding, a child's
  birthday, a move…) that highlight their week in violet. Pure math in
  `src/engine/lifeline.ts`.
- **UI** (`src/ui/`) — React "spreadsheet city": district cards (health, maturity,
  feature badges, uncapped neighborhood chips, borough sub-blocks, landmarks), a
  daily check-in, a **habit catalog** (create/attach/remove with cooldown), a
  landmark builder that attaches habits from the catalog, and the City/Life tabs. A
  temporary `DevPanel` time-travels days for tuning (clearly marked; remove before release).

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
