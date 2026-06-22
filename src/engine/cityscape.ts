// Pure hex-map layout derived from the view model. UI-free and deterministic.
import type { CityViewModel, ConditionLabel } from './types.ts';

export interface PlacedTile {
  key: string;
  kind: 'generic' | 'landmark' | 'feature';
  conditionLabel?: ConditionLabel;
  districtId: string;
  districtName: string;
  label: string;
  emoji?: string;
  tier?: number;
  boroughName?: string;
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

// Axial directions for spiral walking.
const DIRS: Axial[] = [
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
    let q = DIRS[4].q * k;
    let r = DIRS[4].r * k;
    for (let side = 0; side < 6 && out.length < n; side++) {
      for (let step = 0; step < k && out.length < n; step++) {
        out.push({ q, r });
        q += DIRS[side].q;
        r += DIRS[side].r;
      }
    }
    k++;
  }
  return out;
}

function axialToPixel(a: Axial, s: number): { x: number; y: number } {
  return { x: s * Math.sqrt(3) * (a.q + a.r / 2), y: s * 1.5 * a.r };
}

interface BuildOpts {
  size?: number;
  gap?: number;
  maxRowWidth?: number;
}

export function buildCityscape(vm: CityViewModel, opts: BuildOpts = {}): Cityscape {
  const s = opts.size ?? 14;
  const hexW = Math.sqrt(3) * s;
  const hexH = 2 * s;
  const gap = opts.gap ?? hexW * 1.5;
  const maxRowWidth = opts.maxRowWidth ?? 1000;

  const tiles: PlacedTile[] = [];
  let cursorX = 0;
  let rowY = 0;
  let rowMaxHeight = 0;
  let globalMaxX = 0;
  let globalMaxY = 0;

  for (const d of vm.districts) {
    const landmarks = [...d.landmarks.map((l) => ({ l, boroughName: undefined as string | undefined }))];
    for (const b of d.boroughs) {
      for (const l of b.landmarks) landmarks.push({ l, boroughName: b.name });
    }
    const features = d.features;
    const generics = d.generic;
    const total = landmarks.length + features.length + generics.length;
    if (total === 0) continue;

    const coords = hexSpiral(total).map((a) => axialToPixel(a, s));
    const localMinX = Math.min(...coords.map((c) => c.x)) - s;
    const localMaxX = Math.max(...coords.map((c) => c.x)) + s;
    const localMinY = Math.min(...coords.map((c) => c.y)) - s;
    const localMaxY = Math.max(...coords.map((c) => c.y)) + s;
    const clusterW = localMaxX - localMinX;
    const clusterH = localMaxY - localMinY;

    if (cursorX > 0 && cursorX + clusterW > maxRowWidth) {
      cursorX = 0;
      rowY += rowMaxHeight + gap;
      rowMaxHeight = 0;
    }
    const offX = cursorX - localMinX;
    const offY = rowY - localMinY;

    let i = 0;
    const placeNext = (t: Omit<PlacedTile, 'x' | 'y' | 'key'> & { key: string }) => {
      const c = coords[i];
      tiles.push({ ...t, x: c.x + offX, y: c.y + offY });
      i++;
    };

    landmarks.forEach(({ l, boroughName }, j) =>
      placeNext({
        key: `${d.id}:lm:${l.id ?? j}`,
        kind: 'landmark',
        conditionLabel: l.label,
        districtId: d.id,
        districtName: d.name,
        label: l.name,
        tier: l.tier,
        boroughName,
      }),
    );
    features.forEach((f) =>
      placeNext({
        key: `${d.id}:ft:${f.id}`,
        kind: 'feature',
        districtId: d.id,
        districtName: d.name,
        label: f.name,
        emoji: f.emoji,
      }),
    );
    generics.forEach((g, j) =>
      placeNext({
        key: `${d.id}:gn:${j}`,
        kind: 'generic',
        conditionLabel: g.label,
        districtId: d.id,
        districtName: d.name,
        label: d.name,
      }),
    );

    cursorX += clusterW + gap;
    rowMaxHeight = Math.max(rowMaxHeight, clusterH);
    globalMaxX = Math.max(globalMaxX, cursorX - gap);
    globalMaxY = Math.max(globalMaxY, rowY + clusterH);
  }

  return {
    tiles,
    width: Math.max(globalMaxX + hexW, hexW),
    height: Math.max(globalMaxY + hexH, hexH),
    size: s,
  };
}
