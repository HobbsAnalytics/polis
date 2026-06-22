// =============================================================================
// TILE IMAGE MAP — point hex tiles at images (e.g. Midjourney art in public/tiles/).
//
// Empty by default → every tile renders as a colored hex. To add art:
//   1. Drop an image in public/tiles/ (e.g. public/tiles/house_ruin.png)
//   2. Add a mapping line below, keyed most-specific → least-specific:
//        '{districtId}/{kind}/{condition}'  e.g. 'd1/generic/pristine'
//        '{kind}/{condition}'               e.g. 'generic/ruin'
//        '{kind}'                           e.g. 'landmark'
//      condition slug uses 'onfire' for "on fire".
// =============================================================================

export interface TileImageQuery {
  kind: 'generic' | 'landmark' | 'feature';
  conditionLabel?: string;
  districtId: string;
}

export const TILE_IMAGES: Record<string, string> = {
  // Examples (uncomment once the files exist in public/tiles/):
  // 'generic/pristine': 'tiles/house_pristine.png',
  // 'generic/ruin': 'tiles/house_ruin.png',
  // 'landmark': 'tiles/landmark.png',
};

function condSlug(label?: string): string {
  if (!label) return '';
  return label === 'on fire' ? 'onfire' : label;
}

/** Resolve a tile's image path, most-specific first; null if none mapped. */
export function tileImage(q: TileImageQuery, table: Record<string, string> = TILE_IMAGES): string | null {
  const cond = condSlug(q.conditionLabel);
  const keys = [
    cond && `${q.districtId}/${q.kind}/${cond}`,
    cond && `${q.kind}/${cond}`,
    `${q.kind}`,
  ].filter((k): k is string => Boolean(k));
  for (const k of keys) {
    if (table[k]) return table[k];
  }
  return null;
}
