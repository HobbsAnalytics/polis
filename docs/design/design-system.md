# Polis Design System — "Patina"

Status: approved direction (2026-06-25). Concept: `docs/design/city-patina.html`
(screenshots: `city-patina-buildings.png` resting, `city-patina-focus.png` hover).

This is the source of truth for the app restyle **and** for future hand-drawn
tile artwork. When in doubt, the concept file is the reference implementation.

---

## 1. Thesis

Polis is **a city you tend, and that ages with you**. The engine already models
time weathering a place (maturity, decay, entropy, per-building health). The
design's one job: make the **state of your wellbeing legible as a place**, quietly.

**The signature — health is the material.** Condition is expressed as material
aging: **verdigris** (thriving copper-green) → weathered limestone → **oxide**
(rust). That ramp is the only loud thing. Everything else stays disciplined:
limestone ground, ink line, generous space.

Deliberately **not** the AI-default "warm cream + serif + terracotta." The ground
is cool limestone, the positive pole is verdigris, oxide is a *state* (never the
brand accent).

---

## 2. Color tokens

```
--limestone  #E7E9E4   page ground (cool pale grey-green)
--paper      #F3F4F0   raised surfaces (cards, panels)
--ink        #232B28   text, lines, building strokes (deep slate-green near-black)
--ink-2      #5C665F   muted text, captions, secondary
--line       #C9CEC6   hairlines, dividers, rails, inactive bars
--verdigris  #5F8E78   thriving accent (health high), positive CTA focus
--oxide      #B0674C   weathering accent (health low) — a STATE, used sparingly
--active-bg  #E2E5DF   selected/hover row tint
```
Page background uses a faint top-down light: `linear-gradient(180deg,#ECEEE9 0%,--limestone 38%)`.

Usage rules:
- Body text `--ink`; secondary/caption `--ink-2`. Never pure black/white.
- Accents (`--verdigris`, `--oxide`) appear almost entirely **through the health
  ramp** (tiles, pips, bars). Don't sprinkle them as decoration.
- Borders/dividers are always `--line` (1px).

---

## 3. The health ramp  ← the core of the system

A single function maps health `h` ∈ [0,1] to a material color. Drive **every**
condition surface from it: map tiles, district pips, rail bars, the legend, and
the tint behind tile artwork.

Stops (linear-interpolate RGB between them):

```
h 0.00  rgb(110, 99, 91)   #6E635B  ashen — RUIN
h 0.22  rgb(171,107, 80)   #AB6B50  oxide — FAILING ("on fire")
h 0.46  rgb(185,182,166)   #B9B6A6  neutral weathered stone — CRUMBLING
h 0.63  rgb(157,179,159)   #9DB39F  faint sage — WORN
h 1.00  rgb( 95,142,120)   #5F8E78  verdigris — PRISTINE
```

Maps to the engine's five `ConditionLabel`s (`pristine | worn | crumbling | on
fire | ruin`). Note: in Patina, decay reads as **weathering**, not literal fire —
the worst states are rust/ashen, not flame. (UI copy may say "failing" rather
than "on fire.")

Reference implementation: `ramp(h)` in `city-patina.html`. This should live in the
engine view layer (e.g. `viewModel.ts` / `cityscape` consumers) so app and any
generated art share one definition. It replaces the current bright
`DISTRICT_COLORS` / `BOROUGH_COLORS` / `conditionColor` rainbow.

---

## 4. Typography

Three roles, paired deliberately (load via Google Fonts; keep system fallbacks):

| Role | Face | Fallback | Use |
|------|------|----------|-----|
| Display / labels | **Space Grotesk** | ui-sans-serif, system-ui | wordmark, district names, section labels, buttons |
| Utility / data | **IBM Plex Mono** | ui-monospace, Menlo | day counter, dates, numbers, captions, legends, eyebrows |
| Reading | **Newsreader** (italic) | Georgia, serif | the one epigraph / reflective line — used with restraint |

Conventions:
- **Mono = data and wayfinding eyebrows.** Uppercase, letter-spacing `0.14em–0.22em`,
  `--ink-2`, ~10–12px. (e.g. `DAY 142 · 23 JUN`, `DISTRICTS`, `TILE STUDIO ·…`)
- **Grotesk = names and actions.** Wordmark 600 / `0.16em` / uppercase. District
  labels 600, tracked, uppercase. Body/UI 400–500, sentence case.
- **Serif = one line.** Italic epigraph only; never body copy or labels.
- Sentence case for buttons and UI text ("Log today", not "LOG TODAY").

---

## 5. Line & structure

Structure is carried by **line, not color** (color is reserved for health):
- **Tiles**: hairline `--ink` @ 0.14 opacity, 0.6px — a faint parcel edge.
- **Borough sub-parcels**: `--ink` @ 0.12, 1px, dashed `1.5 2.5`.
- **District parcels**: `--ink` @ 0.46, 1.7px, solid, round join/cap.
- **Selected/focused district**: `--ink` @ 1.0, 2.4px.
- Border-radius: small (3–4px) on cards/controls; tiles/hexes are unrounded.
- Shadows: essentially none. One whisper allowed on the map card
  (`0 1px 2px rgba(35,43,40,0.05)`). No glows.

---

## 6. The hex city map

One contiguous hex disc (existing `cityscape.ts` layout — unchanged). Render rules:
- Each tile = a `<polygon>` filled by `ramp(tileHealth)` + the hairline tile edge.
- On top of each generic tile, draw a **building** (§7). Landmarks draw a **monument**.
- Borough dashed sub-outlines, then district solid outlines, on top of tiles.
- **No district text labels at rest.** Names appear only on focus (§9).

---

## 7. Tile-art contract  ← what hand-drawn artwork must honor

The concept's line buildings are placeholders; real art can be richer but must
sit in this contract so the map stays coherent:

- **Ground = patina.** Each tile's background is `ramp(health)`. Art sits on top.
- **Front-elevation, flat, ink line.** Single ink stroke (`--ink`), ~7% of tile
  size in width, no perspective, no drop shadows. Optional ≤6% ink wall fill for
  a hair of depth.
- **Fit the hex.** Stay within the inscribed circle (≈0.87 × hex size). Building
  spans roughly ±0.5 wide, apex ~-0.65, base ~+0.5 (in hex-size units).
- **Weathering = loss of integrity** as health drops, in five bands:
  `PRISTINE` (whole + a detail: door/windows) → `WORN` (whole, plain) →
  `CRUMBLING` (broken roofline) → `FAILING` (jagged/leaning) → `RUIN` (rubble).
- **Landmarks = monuments** (a small temple: platform, columns, pediment),
  distinct from ordinary buildings; they don't fall to rubble the same way.
- A few **archetypes** for variety (house / block / tower …); pick deterministically
  per tile so the map is stable between renders.

Reference: `building(h, seed, s)` and `monument(s)` in `city-patina.html`, and the
**Tile studio** strip (one building across all five weathering bands + landmark).

---

## 8. Components

- **Top bar** — wordmark (grotesk) + serif epigraph on the left; mono utility line
  (day · date · time-of-day) on the right; 1px `--line` divider beneath.
- **Map card** — `--paper`, 1px `--line`, radius 4, mono caption top-left.
- **Districts rail** — mono `DISTRICTS` header; per district: a `ramp(health)` pip,
  grotesk name, mono value, and a 3px health bar (`--line` track, `ramp` fill).
  Rows are hover/selectable (`--active-bg`).
- **Primary button** — ink outline, transparent fill; hover inverts to ink fill /
  paper text; focus-visible ring in `--verdigris`. Sentence case.
- **Legend** — mono caps; the ramp shown as a continuous swatch "weathered →
  thriving"; landmark mark.
- **Tile studio** — reference strip; keep in design docs / dev, not necessarily shipped.

---

## 9. Interaction

- **Rest:** the city is unlabeled — a calm place.
- **Focus a district** (hover, or tap on touch; also hovering its rail row):
  quiet every other district's tiles to ~0.28 opacity, draw the focused district's
  outline at full ink, reveal its **name** at the wedge centroid (grotesk, paper
  halo), and tint its rail row `--active-bg`. Leaving clears it.
- Transitions ~150–170ms ease; **disabled under `prefers-reduced-motion`**.
- Reference: `setFocus(di)` in `city-patina.html`.

---

## 10. Quality floor (non-negotiable)

- Responsive to mobile (rail/studio stack under the map).
- Visible keyboard focus (`:focus-visible`) on all controls.
- `prefers-reduced-motion: reduce` respected (load fades + tile transitions off).
- Text contrast meets WCAG AA against its ground.
- Touch targets ≥ 40px; districts focusable/selectable by tap and keyboard.

---

## 11. Applying to the app (sequence)

1. **Foundation** — add the font links; define the tokens as CSS variables in
   `public/app.css`; set base typography (grotesk UI, mono data, serif epigraph).
   This alone reskins the shell.
2. **Health ramp in code** — add `ramp(h)` to the engine/view layer; retire the
   bright `DISTRICT_COLORS` / `BOROUGH_COLORS` / `conditionColor`.
3. **CityMap** — patina tiles + drawn buildings + monuments + focus-on-hover/select
   (port `building`/`monument`/`setFocus`); districts rail.
4. **Remaining surfaces** — ProfilePage, CheckIn, LifePage, HistoryPage, DevPanel,
   App shell — restyled to the tokens/type/line rules above.
5. Verify (tests + build + headless smoke) per surface; then deploy.
