import { useMemo, useState } from 'react';
import type { CityViewModel, ConditionLabel } from '../engine/types.ts';
import { buildCityscape } from '../engine/cityscape.ts';
import type { PlacedTile } from '../engine/cityscape.ts';
import { tileImage } from '../data/tiles.ts';

const CONDITION_FILL: Record<ConditionLabel, string> = {
  pristine: '#10b981',
  worn: '#84cc16',
  crumbling: '#f59e0b',
  'on fire': '#ea580c',
  ruin: '#78716c',
};
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

interface Tip {
  text: string;
  x: number;
  y: number;
}

export function CityMap({ vm }: { vm: CityViewModel }) {
  const [tip, setTip] = useState<Tip | null>(null);

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
        onMouseMove={(e) => {
          const el = (e.target as Element).closest('[data-info]');
          const info = el?.getAttribute('data-info');
          setTip(info ? { text: info, x: e.clientX, y: e.clientY } : null);
        }}
        onMouseLeave={() => setTip(null)}
      >
        <defs>
          <clipPath id="hexclip">
            <polygon points={points} />
          </clipPath>
        </defs>

        {labels.map((l) => (
          <text key={l.id} x={l.cx} y={l.y} textAnchor="middle" fontSize={s * 1.1} fontWeight="700" fill={l.color}>
            {l.name}
          </text>
        ))}

        {scape.tiles.map((t) => {
          const img = tileImage({ kind: t.kind, conditionLabel: t.conditionLabel, districtId: t.districtId });
          const fill = t.kind === 'feature' ? FEATURE_FILL : CONDITION_FILL[t.conditionLabel ?? 'ruin'];
          const stroke = colorOf(t.districtId);
          return (
            <g key={t.key} transform={`translate(${t.x.toFixed(2)},${t.y.toFixed(2)})`} data-info={tileInfo(t)}>
              {img ? (
                <image
                  href={img}
                  x={-s}
                  y={-s}
                  width={2 * s}
                  height={2 * s}
                  clipPath="url(#hexclip)"
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <polygon points={points} fill={fill} stroke={stroke} strokeWidth={t.kind === 'landmark' ? 2 : 0.5} />
              )}
              {t.kind === 'feature' && (
                <text textAnchor="middle" dominantBaseline="central" fontSize={s}>
                  {t.emoji}
                </text>
              )}
              {t.kind === 'landmark' && !img && (
                <text textAnchor="middle" dominantBaseline="central" fontSize={s * 0.9} fill="#fff">
                  ★
                </text>
              )}
              {t.kind === 'generic' && t.conditionLabel === 'on fire' && !img && (
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
        for detail. Drop art in <code>public/tiles/</code> (see <code>src/data/tiles.ts</code>) to
        replace hexes with images.
      </p>

      <div className="legend">
        {(Object.keys(CONDITION_FILL) as ConditionLabel[]).map((c) => (
          <span key={c} className="legend-item">
            <span className="legend-swatch" style={{ background: CONDITION_FILL[c] }} />
            {c}
          </span>
        ))}
        <span className="legend-item">
          <span className="legend-swatch" style={{ background: FEATURE_FILL }} />
          feature
        </span>
        <span className="legend-item">★ landmark</span>
      </div>

      <div className="citymap">{svg}</div>

      {tip && (
        <div className="week-tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 260), top: tip.y + 14 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
