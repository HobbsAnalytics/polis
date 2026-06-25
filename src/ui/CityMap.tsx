import { useMemo, useState } from 'react';
import type { CityViewModel, Habit } from '../engine/types.ts';
import { ramp } from '../engine/viewModel.ts';
import { buildCityscape, hexCorner, HEX_DIRS } from '../engine/cityscape.ts';
import type { PlacedTile } from '../engine/cityscape.ts';
import { building, monument } from './tileArt.ts';
import { MapDetailPanel } from './DistrictCard.tsx';
import type { Selection } from './DistrictCard.tsx';
import { useTooltip } from './useTooltip.tsx';

const INK = '#232B28';

interface Props {
  vm: CityViewModel;
  habits: Habit[];
  /** When provided, the rail shows a "Log today" CTA that calls this. */
  onLogToday?: () => void;
  canCheckIn?: boolean;
}

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

export function CityMap({ vm, habits, onLogToday, canCheckIn }: Props) {
  const { handlers, tooltip } = useTooltip('[data-info]', 260);
  const [hover, setHover] = useState<string | null>(null); // hovered districtId (transient preview)
  const [selection, setSelection] = useState<Selection>(null); // persistent click selection

  const layout = useMemo(() => {
    const scape = buildCityscape(vm);
    const s = scape.size;
    const points = hexPoints(s);

    const boroughIds = [...new Set(scape.tiles.map((t) => t.boroughId).filter((b): b is string => b != null))];
    const boroughOutlines = boroughIds
      .map((bid) => boundaryPath(scape.tiles.filter((t) => t.boroughId === bid), s))
      .filter(Boolean);

    // Per-district + per-borough boundary/centroid, for the focus + selection overlays.
    const byDistrict = new Map<string, { name: string; path: string; centroid: { x: number; y: number } }>();
    for (const d of vm.districts) {
      const ts = scape.tiles.filter((t) => t.districtId === d.id);
      if (ts.length) byDistrict.set(d.id, { name: d.name, path: boundaryPath(ts, s), centroid: centroid(ts) });
    }
    const byBorough = new Map<string, { name: string; districtId: string; path: string; centroid: { x: number; y: number } }>();
    for (const bid of boroughIds) {
      const ts = scape.tiles.filter((t) => t.boroughId === bid);
      byBorough.set(bid, {
        name: ts[0].boroughName ?? '',
        districtId: ts[0].districtId,
        path: boundaryPath(ts, s),
        centroid: centroid(ts),
      });
    }

    return { scape, s, points, boroughOutlines, byDistrict, byBorough };
  }, [vm]);

  const { scape, s, points, boroughOutlines, byDistrict, byBorough } = layout;
  const fontPx = (s * 0.62).toFixed(1);

  const selDistrictId =
    selection?.level === 'district' ? selection.id : selection?.level === 'borough' ? byBorough.get(selection.id)?.districtId ?? null : null;
  // Which district to keep lit: the hovered one, else the selected one's district.
  const previewDistrict = hover ?? selDistrictId;

  // The outline + name overlay: hover wins (transient), else the selection.
  let overlay: { path: string; x: number; y: number; text: string } | null = null;
  if (hover && byDistrict.has(hover)) {
    const d = byDistrict.get(hover)!;
    overlay = { path: d.path, x: d.centroid.x, y: d.centroid.y, text: d.name.toUpperCase() };
  } else if (selection?.level === 'district' && byDistrict.has(selection.id)) {
    const d = byDistrict.get(selection.id)!;
    overlay = { path: d.path, x: d.centroid.x, y: d.centroid.y, text: d.name.toUpperCase() };
  } else if (selection?.level === 'borough' && byBorough.has(selection.id)) {
    const b = byBorough.get(selection.id)!;
    overlay = { path: b.path, x: b.centroid.x, y: b.centroid.y, text: b.name.toUpperCase() };
  }

  const selectDistrict = (id: string) => setSelection((cur) => (cur?.level === 'district' && cur.id === id ? null : { level: 'district', id }));
  const selectFromTile = (t: PlacedTile) =>
    setSelection((cur) => {
      const next: Selection = t.boroughId ? { level: 'borough', id: t.boroughId } : { level: 'district', id: t.districtId };
      return cur && cur.level === next.level && cur.id === next.id ? null : next;
    });

  return (
    <div className="map-stage">
      {/* Background click (not a tile) clears the selection. */}
      <section className="map-card" onMouseLeave={() => setHover(null)} onClick={() => setSelection(null)}>
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
            const dim = previewDistrict != null && t.districtId !== previewDistrict;
            const art = t.kind === 'landmark' ? monument(s) : t.kind === 'generic' ? building(t.health, i + 3, s) : '';
            return (
              <g
                key={t.key + t.districtId}
                className="tile-g"
                transform={`translate(${t.x.toFixed(2)},${t.y.toFixed(2)})`}
                style={{ opacity: dim ? 0.28 : 1, cursor: 'pointer' }}
                data-info={tileInfo(t)}
                onMouseEnter={() => setHover(t.districtId)}
                onClick={(e) => {
                  e.stopPropagation();
                  selectFromTile(t);
                }}
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

          {boroughOutlines.map((d, i) => (
            <path key={`b${i}`} d={d} fill="none" stroke={INK} strokeOpacity={0.12} strokeWidth={1} strokeDasharray="1.5 2.5" strokeLinejoin="round" />
          ))}
          {[...byDistrict.values()].map((d, i) => (
            <path key={`d${i}`} d={d.path} fill="none" stroke={INK} strokeOpacity={0.46} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
          ))}

          {overlay && (
            <g style={{ pointerEvents: 'none' }}>
              <path d={overlay.path} fill="none" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
              <text
                x={overlay.x.toFixed(1)}
                y={overlay.y.toFixed(1)}
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
                {overlay.text}
              </text>
            </g>
          )}
        </svg>
      </section>

      <aside className="map-rail">
        <div className="rail-h">Districts</div>
        {vm.districts.map((d) => {
          const col = ramp(d.health);
          const pct = Math.round(d.health * 100);
          const active = selection?.level === 'district' && selection.id === d.id;
          return (
            <button
              key={d.id}
              type="button"
              className={`map-district${active || hover === d.id ? ' active' : ''}`}
              onMouseEnter={() => setHover(d.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d.id)}
              onBlur={() => setHover(null)}
              onClick={() => selectDistrict(d.id)}
              aria-pressed={active}
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
        {vm.districts.length === 0 && <p className="abandoned">no districts yet</p>}

        {onLogToday && (
          <button type="button" className="cta" disabled={canCheckIn === false} onClick={onLogToday}>
            {canCheckIn === false ? 'Logged today ✓' : (
              <>
                Log today <span className="arr">→</span>
              </>
            )}
          </button>
        )}
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

      <MapDetailPanel vm={vm} habits={habits} selection={selection} onClear={() => setSelection(null)} />

      {tooltip}
    </div>
  );
}
