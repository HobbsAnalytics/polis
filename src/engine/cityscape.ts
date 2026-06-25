// Pure hex-map layout derived from the view model. UI-free and deterministic.
//
// The whole city is ONE contiguous hex disc. Every tile (building, landmark,
// feature) occupies a cell of that disc. Cells are handed to districts as
// contiguous angular wedges sized by each district's tile count, and within a
// district its boroughs take contiguous sub-wedges — so the map reads as one
// round city carved into irregular districts, each holding visible boroughs.
import type { CityViewModel, ConditionLabel } from './types.ts';

export interface PlacedTile {
  key: string;
  kind: 'generic' | 'landmark' | 'feature';
  conditionLabel?: ConditionLabel;
  /** Raw 0..1 health of the source entity — drives the Patina ramp fill. */
  health: number;
  districtId: string;
  districtName: string;
  boroughId: string | null;
  boroughName?: string;
  label: string;
  emoji?: string;
  tier?: number;
  q: number;
  r: number;
  x: number;
  y: number;
}

export interface Cityscape {
  tiles: PlacedTile[];
  width: number;
  height: number;
  size: number;
}

interface Axial {
  q: number;
  r: number;
}

// Axial neighbor directions; index i corresponds to hex edge i (see hexCorner).
export const HEX_DIRS: Axial[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

/** `n` axial coordinates in spiral order, starting at the center (0,0). */
export function hexSpiral(n: number): Axial[] {
  const out: Axial[] = [];
  if (n <= 0) return out;
  out.push({ q: 0, r: 0 });
  let k = 1;
  while (out.length < n) {
    // Start each ring offset k steps along direction 4, then walk the 6 sides.
    let q = HEX_DIRS[4].q * k;
    let r = HEX_DIRS[4].r * k;
    for (let side = 0; side < 6 && out.length < n; side++) {
      for (let step = 0; step < k && out.length < n; step++) {
        out.push({ q, r });
        q += HEX_DIRS[side].q;
        r += HEX_DIRS[side].r;
      }
    }
    k++;
  }
  return out;
}

export function axialToPixel(a: Axial, s: number): { x: number; y: number } {
  return { x: s * Math.sqrt(3) * (a.q + a.r / 2), y: s * 1.5 * a.r };
}

/** Corner `i` (0..5) of a pointy-top hex of size `s`, relative to its center. */
export function hexCorner(i: number, s: number): { x: number; y: number } {
  const ang = (Math.PI / 180) * (60 * i - 30);
  return { x: s * Math.cos(ang), y: s * Math.sin(ang) };
}

// A tile before it's been assigned a cell — carries everything but coordinates.
type Cell = Omit<PlacedTile, 'q' | 'r' | 'x' | 'y'>;
interface Group {
  boroughId: string | null;
  cells: Cell[];
}

/** Features only unlock at district maturity, so they read as thriving ground. */
const FEATURE_HEALTH = 0.85;

/** The ordered groups (boroughs first, then district-direct) for one district. */
function districtGroups(d: CityViewModel['districts'][number]): Group[] {
  const groups: Group[] = [];
  for (const b of d.boroughs) {
    const cells: Cell[] = [];
    b.generic.forEach((g) =>
      cells.push({
        key: `gn:${g.id}`,
        kind: 'generic',
        conditionLabel: g.label,
        health: g.condition,
        districtId: d.id,
        districtName: d.name,
        boroughId: b.id,
        boroughName: b.name,
        label: b.name,
      }),
    );
    b.landmarks.forEach((l) =>
      cells.push({
        key: `lm:${l.id}`,
        kind: 'landmark',
        conditionLabel: l.label,
        health: l.condition,
        districtId: d.id,
        districtName: d.name,
        boroughId: b.id,
        boroughName: b.name,
        label: l.name,
        tier: l.tier,
      }),
    );
    if (cells.length > 0) groups.push({ boroughId: b.id, cells });
  }
  const direct: Cell[] = [];
  d.landmarks.forEach((l) =>
    direct.push({
      key: `lm:${l.id}`,
      kind: 'landmark',
      conditionLabel: l.label,
      health: l.condition,
      districtId: d.id,
      districtName: d.name,
      boroughId: null,
      label: l.name,
      tier: l.tier,
    }),
  );
  d.features.forEach((f) =>
    direct.push({
      key: `ft:${f.id}`,
      kind: 'feature',
      health: FEATURE_HEALTH,
      districtId: d.id,
      districtName: d.name,
      boroughId: null,
      label: f.name,
      emoji: f.emoji,
    }),
  );
  d.generic.forEach((g) =>
    direct.push({
      key: `gn:${g.id}`,
      kind: 'generic',
      conditionLabel: g.label,
      health: g.condition,
      districtId: d.id,
      districtName: d.name,
      boroughId: null,
      label: d.name,
    }),
  );
  if (direct.length > 0) groups.push({ boroughId: null, cells: direct });
  return groups;
}

interface BuildOpts {
  size?: number;
}

export function buildCityscape(vm: CityViewModel, opts: BuildOpts = {}): Cityscape {
  const s = opts.size ?? 14;

  // Districts in order, each as its ordered groups. Districts with no tiles drop out.
  const districts = vm.districts.map((d) => ({ d, groups: districtGroups(d) })).filter((x) => x.groups.length > 0);
  const total = districts.reduce((n, x) => n + x.groups.reduce((m, g) => m + g.cells.length, 0), 0);
  if (total === 0) return { tiles: [], width: s * 2, height: s * 2, size: s };

  // One disc of `total` cells, swept into contiguous angular wedges. Sorting by
  // angle then radius makes each consecutive run of cells a connected sector.
  const coords = hexSpiral(total)
    .map((a) => ({ a, p: axialToPixel(a, s) }))
    .sort((u, v) => {
      const au = Math.atan2(u.p.y, u.p.x);
      const av = Math.atan2(v.p.y, v.p.x);
      if (au !== av) return au - av;
      return u.p.x * u.p.x + u.p.y * u.p.y - (v.p.x * v.p.x + v.p.y * v.p.y);
    });

  const tiles: PlacedTile[] = [];
  let i = 0;
  for (const { groups } of districts) {
    for (const g of groups) {
      for (const cell of g.cells) {
        const { a, p } = coords[i++];
        tiles.push({ ...cell, q: a.q, r: a.r, x: p.x, y: p.y });
      }
    }
  }

  // Translate so the disc sits in a positive viewbox with an `s` margin.
  const minX = Math.min(...tiles.map((t) => t.x)) - s;
  const minY = Math.min(...tiles.map((t) => t.y)) - s;
  for (const t of tiles) {
    t.x -= minX;
    t.y -= minY;
  }
  const width = Math.max(...tiles.map((t) => t.x)) + s;
  const height = Math.max(...tiles.map((t) => t.y)) + s;
  return { tiles, width, height, size: s };
}
