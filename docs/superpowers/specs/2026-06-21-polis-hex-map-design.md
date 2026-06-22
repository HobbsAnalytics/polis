# Polis — Stage 2: Hex City Map

**Date:** 2026-06-21
**Status:** Approved.

A unified hex-tile visualization of the city on a new **Map** tab, derived from the
existing view model. No engine state changes; pure renderer + a data-driven image hook.

## Tabs

App `page` becomes `'city' | 'map' | 'life'`. Header tabs: City · Map · Life. The
existing City (cards) and Life pages are unchanged.

## Pure layout — `src/engine/cityscape.ts` (UI-free, testable)

`buildCityscape(vm: CityViewModel, opts?): Cityscape`

- Pointy-top axial hex math: center pixel `x = s·√3·(q + r/2)`, `y = s·1.5·r`.
- `hexSpiral(n)` → `n` axial coords in deterministic spiral order from center.
- Per district, gather tiles:
  - **landmarks** = `d.landmarks` + every `d.boroughs[].landmarks` (placed first → center)
  - **features** = `d.features` (next)
  - **generics** = `d.generic` (fill outward)
  - assign spiral coords in that order so landmarks/features sit central.
- Pack district patches in a row-wrapping flow (size each patch to its tile count;
  advance an x-cursor, wrap past `maxRowWidth`) so patches never overlap and read as
  one city.
- Returns:
```ts
interface PlacedTile {
  key: string;
  kind: 'generic' | 'landmark' | 'feature';
  conditionLabel?: ConditionLabel; // generic + landmark
  districtId: string;
  districtName: string;
  label: string;        // landmark/feature name, or district name for generics
  emoji?: string;       // features
  tier?: number;        // landmarks
  boroughName?: string; // when a landmark belongs to a borough
  x: number; y: number; // pixel center
}
interface Cityscape { tiles: PlacedTile[]; width: number; height: number; size: number; }
```

## Image hook — `src/data/tiles.ts`

```ts
interface TileImageQuery { kind; conditionLabel?; districtId; }
tileImage(q, table = TILE_IMAGES): string | null
```
Resolves most-specific → least-specific:
`{districtId}/{kind}/{condSlug}` → `{kind}/{condSlug}` → `{kind}`.
`TILE_IMAGES` is empty by default (→ all tiles render as colored hexes). Images live
in `public/tiles/`; add a file + one mapping line to light up a tile type/condition.
Condition slug: `on fire` → `onfire`. `table` param keeps the resolver testable.

## Rendering — `src/ui/CityMap.tsx`

- One responsive `<svg viewBox="0 0 width height">` (width 100%).
- Each tile: `<g transform="translate(x,y)">`. If `tileImage(...)` returns a path →
  `<image>` clipped to a shared hex `<clipPath>` (`preserveAspectRatio` slice);
  else a hex `<polygon>` filled by condition color (pristine→ruin palette matching
  app.css). Features render in gold with their emoji; landmarks get a thicker stroke;
  generic "on fire" tiles get a 🔥 overlay.
- Districts are distinguished by a per-district accent color (palette by index) on the
  tile stroke + a district label near each patch.
- Instant hover tooltip (same delegated-`data-info` pattern as the Life grid), e.g.
  "District One · landmark: Sobriety (tier 4) · pristine". A small condition legend.

## Scope

Boroughs: their landmarks sit within the district patch and the tooltip names the
borough; no separate borough region in v1. Generic tile count uncapped (fine for SVG
at realistic counts). Map is read-only (no interaction beyond hover).

## Testing

`cityscape.test.ts`: tile count = Σ(generics + landmarks incl. borough + features);
build is deterministic (equal on repeat); no two tiles share a rounded coordinate;
width/height > 0. `tiles.test.ts`: `tileImage` returns a configured path, respects
specificity order, falls back to `null`. Browser: verify colored-hex map renders;
drop one test image and confirm it paints in its hex.
