import { useMemo } from 'react';
import type { CityViewModel } from '../engine/types.ts';
import { CONDITIONS, conditionColor } from '../engine/viewModel.ts';
import { buildCityscape } from '../engine/cityscape.ts';
import type { PlacedTile } from '../engine/cityscape.ts';
import { useTooltip } from './useTooltip.tsx';

const FEATURE_FILL = '#eab308';
const DISTRICT_COLORS = ['#3b82f6', '#a855f7', '#14b8a6', '#ef4444', '#f59e0b', '#8b5cf6', '#0ea5e9', '#db2777'];

function hexPoints(s: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(s * Math.cos(ang)).toFixed(2)},${(s * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function tileInfo(t: PlacedTile): string {
  if (t.kind === 'feature') return `${t.districtName} · ${t.label}`;
  if (t.kind === 'landmark') {
    const where = t.boroughName ? `${t.districtName} › ${t.boroughName}` : t.districtName;
    return `${where} · landmark: ${t.label} (tier ${t.tier ?? 0}) · ${t.conditionLabel}`;
  }
  return `${t.districtName} · neighborhood · ${t.conditionLabel}`;
}

export function CityMap({ vm }: { vm: CityViewModel }) {
  const { handlers, tooltip } = useTooltip('[data-info]', 260);

  const svg = useMemo(() => {
    const scape = buildCityscape(vm);
    const s = scape.size;
    const points = hexPoints(s);
    const colorOf = (districtId: string) =>
      DISTRICT_COLORS[Math.max(0, vm.districts.findIndex((d) => d.id === districtId)) % DISTRICT_COLORS.length];

    // District labels at the top of each patch.
    const labels = vm.districts
      .map((d) => {
        const ts = scape.tiles.filter((t) => t.districtId === d.id);
        if (ts.length === 0) return null;
        const cx = ts.reduce((a, t) => a + t.x, 0) / ts.length;
        const minY = Math.min(...ts.map((t) => t.y));
        return { id: d.id, name: d.name, cx, y: minY - s * 1.2, color: colorOf(d.id) };
      })
      .filter(Boolean) as { id: string; name: string; cx: number; y: number; color: string }[];

    return (
      <svg
        viewBox={`0 ${-s * 2} ${scape.width} ${scape.height + s * 2}`}
        width="100%"
        role="img"
        aria-label="Hex city map"
        {...handlers}
      >
        {labels.map((l) => (
          <text key={l.id} x={l.cx} y={l.y} textAnchor="middle" fontSize={s * 1.1} fontWeight="700" fill={l.color}>
            {l.name}
          </text>
        ))}

        {scape.tiles.map((t) => {
          const fill = t.kind === 'feature' ? FEATURE_FILL : conditionColor(t.conditionLabel ?? 'ruin');
          const stroke = colorOf(t.districtId);
          return (
            <g key={t.key} transform={`translate(${t.x.toFixed(2)},${t.y.toFixed(2)})`} data-info={tileInfo(t)}>
              <polygon points={points} fill={fill} stroke={stroke} strokeWidth={t.kind === 'landmark' ? 2 : 0.5} />
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
      </svg>
    );
  }, [vm]);

  return (
    <div className="panel">
      <h2>City map</h2>
      <p className="muted">
        Each hex is a building; districts are neighborhoods. Color shows condition — hover any tile
        for detail.
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
