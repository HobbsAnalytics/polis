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
- **UI** (`src/ui/`) — React "spreadsheet city": district cards (health, maturity,
  feature badges, uncapped neighborhood chips, borough sub-blocks, landmarks), a
  daily check-in, a **habit catalog** (create/attach/remove with cooldown), and a
  landmark builder that attaches habits from the catalog. A temporary
  `DevPanel` time-travels days for tuning (clearly marked; remove before release).

## Commands

```bash
npm install      # react, react-dom, esbuild
npm test         # run the engine + persistence suite
npm run dev      # esbuild dev server at http://localhost:8000
npm run build    # bundle to public/app.js
```

Open `public/index.html` (served by `npm run dev`). State saves to your browser's
localStorage; use Export/Import to back up or move between machines.

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
