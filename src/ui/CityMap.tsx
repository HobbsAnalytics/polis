import { useMemo, useState } from 'react';
import type { CityViewModel } from '../engine/types.ts';
import { ramp } from '../engine/viewModel.ts';
import { buildCityscape, hexCorner, HEX_DIRS } from '../engine/cityscape.ts';
import type { PlacedTile } from '../engine/cityscape.ts';
import { building, monument } from './tileArt.ts';
import { useTooltip } from './useTooltip.tsx';

const INK = '#232B28';

function hexPoints(s: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const c = hexCorner(i, s);
    return `${c.x.toFixed(2)},${c.y.toFixed(2)}`;
  }).join(' ');
}

function tileInfo(t: PlacedTile): string {
  if (t.kind === 'feature') return `${t.districtName} · ${t.label}`;
  const where = t.boroughName ? `${t.districtName} › ${t.boroughName}` : t.districtName;
  if (t.kind === 'landmark') return `${where} · landmark: ${t.label} (tier ${t.tier ?? 0}) · ${t.conditionLabel}`;
  return `${where} · ${t.conditionLabel}`;
}

/** Trace the boundary of a set of hex cells: any edge whose neighbor is outside the set. */
function boundaryPath(cells: PlacedTile[], s: number): string {
  const inSet = new Set(cells.map((c) => `${c.q},${c.r}`));
  const segs: string[] = [];
  for (const c of cells) {
    for (let k = 0; k < 6; k++) {
      const nb = `${c.q + HEX_DIRS[k].q},${c.r + HEX_DIRS[k].r}`;
      if (inSet.has(nb)) continue;
      const a = hexCorner(k, s);
      const b = hexCorner((k + 1) % 6, s);
      segs.push(`M${(c.x + a.x).toFixed(2)},${(c.y + a.y).toFixed(2)}L${(c.x + b.x).toFixed(2)},${(c.y + b.y).toFixed(2)}`);
    }
  }
  return segs.join('');
}

function centroid(tiles: PlacedTile[]): { x: number; y: number } {
  return {
    x: tiles.reduce((a, t) => a + t.x, 0) / tiles.length,
    y: tiles.reduce((a, t) => a + t.y, 0) / tiles.length,
  };
}

export function CityMap({ vm }: { vm: CityViewModel }) {
  const { handlers, tooltip } = useTooltip('[data-info]', 260);
  const [focus, setFocus] = useState<string | null>(null);
  const toggle = (id: string) => setFocus((cur) => (cur === id ? null : id));

  const layout = useMemo(() => {
    const scape = buildCityscape(vm);
    const s = scape.size;
    const points = hexPoints(s);

    // Borough dashed sub-outlines (district order, boroughs first).
    const boroughIds = [...new Set(scape.tiles.map((t) => t.boroughId).filter((b): b is string => b != null))];
    const boroughOutlines = boroughIds
      .map((bid) => boundaryPath(scape.tiles.filter((t) => t.boroughId === bid), s))
      .filter(Boolean);

    // Per-district: solid outline, boundary (for focus), centroid (for the focus label).
    const districts = vm.districts
      .map((d) => {
        const ts = scape.tiles.filter((t) => t.districtId === d.id);
        if (ts.length === 0) return null;
        return { id: d.id, name: d.name, health: d.health, path: boundaryPath(ts, s), centroid: centroid(ts) };
      })
      .filter(Boolean) as { id: string; name: string; health: number; path: string; centroid: { x: number; y: number } }[];

    return { scape, s, points, boroughOutlines, districts };
  }, [vm]);

  const { scape, s, points, boroughOutlines, districts } = layout;
  const fontPx = (s * 0.62).toFixed(1);
  const focused = focus != null ? districts.find((d) => d.id === focus) : undefined;

  return (
    <div className="map-stage">
      <section className="map-card" onMouseLeave={() => setFocus(null)}>
        <span className="map-caption">the city · one place, lived-in</span>
        <svg
          className="city-svg"
          viewBox={`0 ${(-s * 1.2).toFixed(1)} ${scape.width.toFixed(1)} ${(scape.height + s * 1.4).toFixed(1)}`}
          width="100%"
          role="img"
          aria-label="Hex city map of drawn buildings, tinted by condition"
          {...handlers}
        >
          {scape.tiles.map((t, i) => {
            const dim = focus != null && t.districtId !== focus;
            const art = t.kind === 'landmark' ? monument(s) : t.kind === 'generic' ? building(t.health, i + 3, s) : '';
            return (
              <g
                key={t.key + t.districtId}
                className="tile-g"
                transform={`translate(${t.x.toFixed(2)},${t.y.toFixed(2)})`}
                style={{ opacity: dim ? 0.28 : 1, cursor: 'pointer' }}
                data-info={tileInfo(t)}
                onMouseEnter={() => setFocus(t.districtId)}
                onClick={() => toggle(t.districtId)}
              >
                <polygon points={points} fill={ramp(t.health)} stroke={INK} strokeOpacity={0.14} strokeWidth={0.6} />
                {art && <g dangerouslySetInnerHTML={{ __html: art }} />}
                {t.kind === 'feature' && (
                  <text textAnchor="middle" dominantBaseline="central" fontSize={s * 0.9} style={{ pointerEvents: 'none' }}>
                    {t.emoji}
                  </text>
                )}
              </g>
            );
          })}

          {/* Borough dashed sub-outlines, then district solid outlines. */}
          {boroughOutlines.map((d, i) => (
            <path key={`b${i}`} d={d} fill="none" stroke={INK} strokeOpacity={0.12} strokeWidth={1} strokeDasharray="1.5 2.5" strokeLinejoin="round" />
          ))}
          {districts.map((d) => (
            <path key={`d${d.id}`} d={d.path} fill="none" stroke={INK} strokeOpacity={0.46} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {/* Focus layer: full-ink outline + the district name (revealed only on focus). */}
          {focused && (
            <g style={{ pointerEvents: 'none' }}>
              <path d={focused.path} fill="none" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
              <text
                x={focused.centroid.x.toFixed(1)}
                y={focused.centroid.y.toFixed(1)}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="Space Grotesk, sans-serif"
                fontSize={fontPx}
                fontWeight={600}
                letterSpacing="1.6"
                fill={INK}
                stroke="#F3F4F0"
                strokeWidth={2.6}
                paintOrder="stroke"
              >
                {focused.name.toUpperCase()}
              </text>
            </g>
          )}
        </svg>
      </section>

      <aside className="map-rail">
        <div className="rail-h">Districts</div>
        {districts.map((d) => {
          const col = ramp(d.health);
          const pct = Math.round(d.health * 100);
          return (
            <button
              key={d.id}
              type="button"
              className={`map-district${focus === d.id ? ' active' : ''}`}
              onMouseEnter={() => setFocus(d.id)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(d.id)}
              onBlur={() => setFocus(null)}
              onClick={() => toggle(d.id)}
              aria-pressed={focus === d.id}
            >
              <span className="row1">
                <span className="map-pip" style={{ background: col }} />
                <span className="dname">{d.name}</span>
                <span className="dpct">{pct}</span>
              </span>
              <span className="map-bar">
                <i style={{ width: `${pct}%`, background: col }} />
              </span>
            </button>
          );
        })}
        {districts.length === 0 && <p className="abandoned">no districts yet</p>}
      </aside>

      <div className="map-legend">
        <span>weathered</span>
        <span className="map-ramp" aria-hidden="true">
          {Array.from({ length: 24 }, (_, i) => (
            <i key={i} style={{ background: ramp(i / 23) }} />
          ))}
        </span>
        <span>thriving</span>
        <span className="legmark">▲ landmark</span>
      </div>

      {tooltip}
    </div>
  );
}
