import { useMemo } from 'react';
import type { CityViewModel } from '../engine/types.ts';
import { CONDITIONS, conditionColor } from '../engine/viewModel.ts';
import { buildCityscape, hexCorner, HEX_DIRS } from '../engine/cityscape.ts';
import type { PlacedTile } from '../engine/cityscape.ts';
import { useTooltip } from './useTooltip.tsx';

const FEATURE_FILL = '#eab308';
const DISTRICT_COLORS = ['#3b82f6', '#a855f7', '#14b8a6', '#ef4444', '#f59e0b', '#8b5cf6', '#0ea5e9', '#db2777'];
const BOROUGH_COLORS = ['#1e293b', '#7c2d12', '#064e3b', '#581c87', '#0c4a6e', '#713f12'];

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
  return `${where} · neighborhood · ${t.conditionLabel}`;
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

  const svg = useMemo(() => {
    const scape = buildCityscape(vm);
    const s = scape.size;
    const points = hexPoints(s);
    const districtColor = (districtId: string) =>
      DISTRICT_COLORS[Math.max(0, vm.districts.findIndex((d) => d.id === districtId)) % DISTRICT_COLORS.length];

    // Stable borough color by global borough order.
    const boroughOrder = vm.districts.flatMap((d) => d.boroughs.map((b) => b.id));
    const boroughColor = (boroughId: string) =>
      BOROUGH_COLORS[Math.max(0, boroughOrder.indexOf(boroughId)) % BOROUGH_COLORS.length];

    const districtLabels = vm.districts
      .map((d) => {
        const ts = scape.tiles.filter((t) => t.districtId === d.id);
        if (ts.length === 0) return null;
        const c = centroid(ts);
        return { id: d.id, name: d.name, x: c.x, y: Math.min(...ts.map((t) => t.y)) - s * 1.1, color: districtColor(d.id) };
      })
      .filter(Boolean) as { id: string; name: string; x: number; y: number; color: string }[];

    // Borough outlines + labels, traced from each borough's cells.
    const boroughs = boroughOrder
      .map((bid) => {
        const ts = scape.tiles.filter((t) => t.boroughId === bid);
        if (ts.length === 0) return null;
        const c = centroid(ts);
        return { id: bid, name: ts[0].boroughName ?? '', path: boundaryPath(ts, s), x: c.x, y: c.y, color: boroughColor(bid) };
      })
      .filter(Boolean) as { id: string; name: string; path: string; x: number; y: number; color: string }[];

    return (
      <svg
        viewBox={`0 ${-s * 2} ${scape.width} ${scape.height + s * 2}`}
        width="100%"
        role="img"
        aria-label="Hex city map"
        {...handlers}
      >
        {scape.tiles.map((t) => {
          const fill = t.kind === 'feature' ? FEATURE_FILL : conditionColor(t.conditionLabel ?? 'ruin');
          return (
            <g key={t.key + t.districtId} transform={`translate(${t.x.toFixed(2)},${t.y.toFixed(2)})`} data-info={tileInfo(t)}>
              <polygon points={points} fill={fill} stroke={districtColor(t.districtId)} strokeWidth={t.kind === 'landmark' ? 1.5 : 0.5} />
              {t.kind === 'feature' && (
                <text textAnchor="middle" dominantBaseline="central" fontSize={s}>
                  {t.emoji}
                </text>
              )}
              {t.kind === 'landmark' && (
                <text textAnchor="middle" dominantBaseline="central" fontSize={s * 0.9} fill="#fff">
                  ★
                </text>
              )}
              {t.kind === 'generic' && t.conditionLabel === 'on fire' && (
                <text textAnchor="middle" dominantBaseline="central" fontSize={s * 0.8}>
                  🔥
                </text>
              )}
            </g>
          );
        })}

        {/* Borough outlines sit above the tiles so the section reads clearly. */}
        {boroughs.map((b) => (
          <path
            key={b.id}
            d={b.path}
            fill="none"
            stroke={b.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.9}
          />
        ))}
        {boroughs.map((b) => (
          <text
            key={`lbl-${b.id}`}
            x={b.x}
            y={b.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={s * 0.7}
            fontWeight="700"
            fill={b.color}
            stroke="#fff"
            strokeWidth={0.6}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {b.name}
          </text>
        ))}

        {districtLabels.map((l) => (
          <text key={l.id} x={l.x} y={l.y} textAnchor="middle" fontSize={s * 1.1} fontWeight="700" fill={l.color}>
            {l.name}
          </text>
        ))}
      </svg>
    );
  }, [vm]);

  return (
    <div className="panel">
      <h2>City map</h2>
      <p className="muted">
        One city, carved into districts; boroughs are outlined sections within them. Each hex is a
        single building with its own condition — hover any tile for detail.
      </p>

      <div className="legend">
        {CONDITIONS.map((d) => (
          <span key={d.label} className="legend-item">
            <span className="legend-swatch" style={{ background: d.color }} />
            {d.label}
          </span>
        ))}
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: FEATURE_FILL }} />
          feature
        </span>
        <span className="legend-item">★ landmark</span>
      </div>

      <div className="citymap">{svg}</div>

      {tooltip}
    </div>
  );
}
