// Per-building neighborhood model. Each neighborhood carries its own health and
// drifts individually, so a district reads as a patchwork — some blocks thriving
// while others crumble. Pure and deterministic (no clock, no RNG): per-building
// variance is derived from a hash of the stable id, so the same building always
// decays at the same relative rate.
import type { Borough, District, Neighborhood, Settings } from './types.ts';

/** Floor on generic buildings per container, so even a neglected area looks like a place. */
export const MIN_DISTRICT_NEIGHBORHOODS = 6;
export const MIN_BOROUGH_NEIGHBORHOODS = 4;

/** Deterministic 32-bit hash of a string (FNV-1a). */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A stable per-building multiplier on entropy (the resting decay), in [0.5, 1.5].
 * Buildings with a high factor crumble faster unless habits keep them up, so
 * identical habits still produce a varied skyline over time.
 */
export function entropyVariance(id: string): number {
  return 0.5 + (hashStr(id) % 1000) / 999;
}

function neighborhoodCount(health: number, min: number, baseSpread: number): number {
  return Math.max(min, Math.round(health * baseSpread));
}

function make(
  districtId: string,
  boroughId: string | null,
  index: number,
  health: number,
  createdDay: number,
): Neighborhood {
  return { id: `nb-${districtId}-${boroughId ?? 'd'}-${index}`, districtId, boroughId, health, createdDay };
}

/**
 * Build the full neighborhood set for a city: each district seeds its own direct
 * buildings (from its health) and each borough seeds its own (from its health).
 * Used by the fresh seed and by migration of pre-neighborhood saves.
 */
export function seedNeighborhoods(
  districts: District[],
  boroughs: Borough[],
  baseSpread: number,
  createdDay = 0,
): Neighborhood[] {
  const out: Neighborhood[] = [];
  for (const d of districts) {
    const n = neighborhoodCount(d.healthDirect, MIN_DISTRICT_NEIGHBORHOODS, baseSpread);
    for (let i = 0; i < n; i++) out.push(make(d.id, null, i, d.healthDirect, createdDay));
  }
  for (const b of boroughs) {
    const n = neighborhoodCount(b.healthDirect, MIN_BOROUGH_NEIGHBORHOODS, Math.round(baseSpread / 2));
    for (let i = 0; i < n; i++) out.push(make(b.districtId, b.id, i, b.healthDirect, createdDay));
  }
  return out;
}

/** Neighborhoods a brand-new district starts with (at its seed health). */
export function neighborhoodsForDistrict(d: District, baseSpread: number, createdDay: number): Neighborhood[] {
  const n = neighborhoodCount(d.healthDirect, MIN_DISTRICT_NEIGHBORHOODS, baseSpread);
  return Array.from({ length: n }, (_, i) => make(d.id, null, i, d.healthDirect, createdDay));
}

/** Neighborhoods a brand-new borough starts with (at its seed health). */
export function neighborhoodsForBorough(b: Borough, baseSpread: number, createdDay: number): Neighborhood[] {
  const n = neighborhoodCount(b.healthDirect, MIN_BOROUGH_NEIGHBORHOODS, Math.round(baseSpread / 2));
  return Array.from({ length: n }, (_, i) => make(b.districtId, b.id, i, b.healthDirect, createdDay));
}

/**
 * Legacy growth: as a district matures it accrues new buildings that never
 * vanish. Returns any neighborhoods to append so each district holds at least
 * `MIN_DISTRICT_NEIGHBORHOODS + floor(maturity)` direct buildings. Only ever adds.
 */
export function grownNeighborhoods(
  districts: District[],
  existing: Neighborhood[],
  health: (districtId: string) => number,
  createdDay: number,
): Neighborhood[] {
  const additions: Neighborhood[] = [];
  for (const d of districts) {
    const direct = existing.filter((n) => n.districtId === d.id && n.boroughId === null);
    const desired = MIN_DISTRICT_NEIGHBORHOODS + Math.floor(d.maturity);
    for (let i = direct.length; i < desired; i++) {
      additions.push(make(d.id, null, i, health(d.id), createdDay));
    }
  }
  return additions;
}

/**
 * One day of evolution for a single building. Same shape as the district/landmark
 * scalar update, but its entropy is scaled by the building's stable variance so
 * buildings diverge. `gain`/`penalty` derive from the habits targeting the
 * building's container(s); the caller resolves those.
 */
export function updateNeighborhood(
  n: Neighborhood,
  delta: number,
  s: Settings,
): number {
  // `delta` is the habit-driven change (excluding entropy); entropy is varied here.
  const v = -s.entropyPerDay * entropyVariance(n.id);
  const next = n.health + delta + v;
  return next < 0 ? 0 : next > 1 ? 1 : next;
}
