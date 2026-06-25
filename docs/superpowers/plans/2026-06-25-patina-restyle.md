# Patina visual restyle — phased plan

> Source of truth: `docs/design/design-system.md` + `docs/design/city-patina.html`.
> Visual only (plus the `ramp` function and the focus interaction). No behavior/logic changes.
> TDD for engine changes; verify UI with build + headless Playwright smoke + screenshots.

**Goal:** Apply the "Patina" design system across the app — limestone ground, ink line,
health-as-material ramp, three-typeface system — and ship it.

---

## Phase 1 — Foundation (this phase)

**CSS (`public/index.html`, `public/app.css`)**
- Add the Google Fonts `<link>`s (Space Grotesk, IBM Plex Mono, Newsreader) to `index.html`.
- In `:root`, add Patina tokens: `--limestone --paper --ink --ink-2 --line --verdigris --oxide
  --active-bg`, the font vars `--sans --mono --serif`, and the 5 ramp-stop vars
  `--c-ruin #6E635B --c-failing #AB6B50 --c-crumbling #B9B6A6 --c-worn #9DB39F --c-pristine #5F8E78`.
- Repoint the existing condition vars to the ramp (retires the rainbow app-wide):
  `--pristine→--c-pristine, --worn→--c-worn, --crumbling→--c-crumbling, --onfire→--c-failing, --ruin→--c-ruin`.
- Alias the legacy `--stone-*` scale onto Patina (surfaces→paper/limestone, borders→line,
  text→ink/ink-2) so every current `var(--stone-*)` reference resolves to Patina — "defining
  tokens reskins the shell" (§11.1). Swap hardcoded `#fff` surfaces to `--paper`.
- Base typography: body `--sans`, `--ink`, antialiased, limestone top-down gradient ground.
- Reskin **header**: wordmark grotesk 600 / 0.16em / uppercase; subtitle as mono utility line
  (`--ink-2`); 1px `--line` divider; tabs to line/ink (active = ink fill, paper text,
  `:focus-visible` verdigris ring); era-banner to paper + `--line`.
- Fix `.tcond-*` text colors to legible patina tones (AA).

**Engine (`src/engine/viewModel.ts`)** — TDD
- Add `ramp(h: number): string` — the 5-stop linear RGB interpolation from the concept,
  clamped to [0,1]. Single source for health→material.
- Re-express `conditionColor(label)` via `ramp(LABEL_HEALTH[label])` (ruin 0, on fire 0.22,
  crumbling 0.46, worn 0.63, pristine 1). Update `CONDITIONS[].color` to the matching ramp stops.
- Tests first: `ramp` endpoints, a midpoint interpolation, out-of-range clamp; `conditionColor`
  returns the ramp stop per label.

**Verify:** full suite green; clean build. (No new screenshots required for Phase 1; shell visible in Phase 2 smoke.)

---

## Phase 2 — CityMap (the hero)

Port the concept into `src/ui/CityMap.tsx`:
- Tiles filled by `ramp(tileHealth)` + hairline ink edge (`--ink` @0.14, 0.6px). Generic tiles
  draw a `building(h, seed, s)`; landmark tiles draw a `monument(s)`. Port both from the concept
  into a small pure helper (e.g. `src/ui/tileArt.ts`), keyed deterministically per tile.
- Borough dashed sub-outlines (`--ink` @0.12, dashed `1.5 2.5`), district solid outlines
  (`--ink` @0.46, 1.7px). **No district labels at rest.**
- Focus-on-hover/select (port `setFocus`): fade other districts to ~0.28, full-ink outline +
  grotesk name (paper halo) at the focused district's centroid, highlight its rail row. Touch =
  tap; keyboard-focusable; transitions ~150–170ms, disabled under `prefers-reduced-motion`.
- Districts **rail** (mono `DISTRICTS`, ramp pip, grotesk name, mono value, 3px ramp bar) +
  **legend** (ramp swatch "weathered → thriving" + landmark mark).
- Tile health needs to reach the map: thread per-tile `health` through `PlacedTile`/cityscape
  (currently only `conditionLabel`); keep `cityscape` layout identical (tile counts unchanged).

**Verify:** tests green; clean build; headless smoke (load; hover/focus a district reveals its
name + fades others; landmarks render as monuments; condition tints read as patina); screenshot.
**PAUSE — show screenshot + results. No deploy.**

---

## Phase 3 — Remaining surfaces (after Phase 2 approval)

Restyle to tokens/type/line rules, behavior unchanged:
`ProfilePage`, `CheckIn`, `LifePage`, `HistoryPage`, `DevPanel` (kept, just restyled), App shell.
Per surface: verify tests + build + smoke + screenshot. Then **STOP and show final state before pushing.**

**Quality floor (all phases):** responsive to mobile, visible `:focus-visible`, reduced-motion
respected, WCAG AA contrast, touch targets ≥40px.
