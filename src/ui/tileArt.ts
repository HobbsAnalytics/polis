// Drawn tile art for the Patina city map — front-elevation ink-line buildings on
// a patina ground, weathering as health drops; landmarks are small monuments.
// Ported faithfully from docs/design/city-patina.html (building/monument) and
// kept pure + deterministic so renders are stable. Returns SVG inner-markup
// strings (injected under each tile <g>). Honors the tile-art contract (§7).

const INK = '#232B28';

/**
 * A small line building, weathering with health `h` (0..1). `seed` picks a stable
 * archetype (house / block / tower); `s` is the hex size. Integrity/detail falls
 * away as health drops: pristine → worn → crumbling → failing → ruin (rubble).
 */
export function building(h: number, seed: number, s: number, forceType?: number): string {
  const r = (Math.sin(seed * 127.1) * 43758.5453) % 1;
  const rnd = r - Math.floor(r);
  const type = forceType != null ? forceType : Math.floor(Math.abs(rnd) * 3);
  const sw = (s * 0.072).toFixed(2);
  const wall = 'rgba(35,43,40,0.06)';
  const lvl = h > 0.75 ? 4 : h > 0.55 ? 3 : h > 0.38 ? 2 : h > 0.18 ? 1 : 0;
  const base = s * 0.5;
  const P = (n: number) => n.toFixed(1);

  if (lvl === 0) {
    let d = '';
    d += `M${P(-s * 0.46)},${P(base)}L${P(-s * 0.24)},${P(base)}`;
    d += `M${P(-s * 0.16)},${P(base)}L${P(-s * 0.16)},${P(base - s * 0.18)}L${P(-s * 0.02)},${P(base)}`;
    d += `M${P(s * 0.05)},${P(base)}L${P(s * 0.2)},${P(base - s * 0.12)}L${P(s * 0.33)},${P(base)}`;
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-opacity="0.55" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  let g = '';
  if (type === 0) {
    // gabled house
    const w = s * 0.9;
    const top = lvl <= 1 ? -s * 0.02 : -s * 0.06;
    const apex = lvl <= 1 ? -s * 0.34 : -s * 0.62;
    g += `<path d="M${P(-w / 2)},${P(base)} L${P(-w / 2)},${P(top)} L${P(w / 2)},${P(top)} L${P(w / 2)},${P(base)} Z" fill="${wall}" stroke="${INK}" stroke-opacity="0.72" stroke-width="${sw}" stroke-linejoin="round"/>`;
    if (lvl >= 2) {
      g += `<path d="M${P(-w / 2 * 1.14)},${P(top)} L0,${P(apex)} L${P(w / 2 * 1.14)},${P(top)}" fill="none" stroke="${INK}" stroke-opacity="0.72" stroke-width="${sw}" stroke-linejoin="round"/>`;
    } else {
      g += `<path d="M${P(-w / 2 * 1.06)},${P(top)} L${P(-w * 0.16)},${P(apex * 0.78)}" fill="none" stroke="${INK}" stroke-opacity="0.6" stroke-width="${sw}" stroke-linecap="round"/>`;
      g += `<path d="M${P(w / 2 * 1.06)},${P(top)} L${P(w * 0.14)},${P(apex * 0.66)}" fill="none" stroke="${INK}" stroke-opacity="0.6" stroke-width="${sw}" stroke-linecap="round"/>`;
    }
    if (lvl >= 4) {
      const dw = s * 0.16;
      const dh = s * 0.26;
      g += `<path d="M${P(-dw / 2)},${P(base)} L${P(-dw / 2)},${P(base - dh)} L${P(dw / 2)},${P(base - dh)} L${P(dw / 2)},${P(base)}" fill="none" stroke="${INK}" stroke-opacity="0.5" stroke-width="${(Number(sw) * 0.8).toFixed(2)}"/>`;
    }
  } else if (type === 1) {
    // flat block
    const w = s * 1.04;
    const top = lvl <= 1 ? base - s * 0.3 : -s * 0.26;
    g += `<path d="M${P(-w / 2)},${P(base)} L${P(-w / 2)},${P(top)} L${P(w / 2)},${P(top)} L${P(w / 2)},${P(base)} Z" fill="${wall}" stroke="${INK}" stroke-opacity="0.72" stroke-width="${sw}" stroke-linejoin="round"/>`;
    if (lvl >= 2) g += `<path d="M${P(-w / 2 * 1.1)},${P(top)} L${P(w / 2 * 1.1)},${P(top)}" fill="none" stroke="${INK}" stroke-opacity="0.72" stroke-width="${sw}"/>`;
    if (lvl >= 4) {
      const wy = (top + base) / 2 - s * 0.02;
      [-w * 0.22, w * 0.2].forEach((wx) => {
        g += `<rect x="${P(wx - s * 0.07)}" y="${P(wy - s * 0.08)}" width="${P(s * 0.14)}" height="${P(s * 0.16)}" fill="none" stroke="${INK}" stroke-opacity="0.42" stroke-width="${(Number(sw) * 0.75).toFixed(2)}"/>`;
      });
    }
    if (lvl === 1) g += `<path d="M${P(w * 0.06)},${P(top)} L${P(-w * 0.03)},${P((top + base) / 2)} L${P(w * 0.05)},${P(base)}" fill="none" stroke="${INK}" stroke-opacity="0.4" stroke-width="${(Number(sw) * 0.7).toFixed(2)}"/>`;
  } else {
    // tower
    const w = s * 0.54;
    const top = lvl <= 1 ? -s * 0.16 : -s * 0.66;
    g += `<path d="M${P(-w / 2)},${P(base)} L${P(-w / 2)},${P(top)} L${P(w / 2)},${P(top)} L${P(w / 2)},${P(base)} Z" fill="${wall}" stroke="${INK}" stroke-opacity="0.72" stroke-width="${sw}" stroke-linejoin="round"/>`;
    if (lvl >= 2) g += `<path d="M${P(-w / 2)},${P(top + (base - top) * 0.34)} L${P(w / 2)},${P(top + (base - top) * 0.34)}" fill="none" stroke="${INK}" stroke-opacity="0.5" stroke-width="${(Number(sw) * 0.8).toFixed(2)}"/>`;
    if (lvl <= 1) g += `<path d="M${P(-w / 2)},${P(top)} L${P(-w * 0.12)},${P(top - s * 0.1)} L${P(w * 0.1)},${P(top)} L${P(w / 2)},${P(top - s * 0.05)}" fill="none" stroke="${INK}" stroke-opacity="0.58" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return g;
}

/** A small drawn monument (temple): platform, columns, pediment. */
export function monument(s: number): string {
  const sw = (s * 0.075).toFixed(2);
  const base = s * 0.46;
  const top = -s * 0.52;
  let g = '';
  g += `<path d="M${(-s * 0.5).toFixed(1)},${base.toFixed(1)} L${(s * 0.5).toFixed(1)},${base.toFixed(1)}" stroke="${INK}" stroke-opacity="0.8" stroke-width="${sw}" stroke-linecap="round"/>`;
  [-s * 0.3, 0, s * 0.3].forEach((cx) => {
    g += `<path d="M${cx.toFixed(1)},${base.toFixed(1)} L${cx.toFixed(1)},${(-s * 0.16).toFixed(1)}" stroke="${INK}" stroke-opacity="0.8" stroke-width="${sw}"/>`;
  });
  g += `<path d="M${(-s * 0.42).toFixed(1)},${(-s * 0.16).toFixed(1)} L${(s * 0.42).toFixed(1)},${(-s * 0.16).toFixed(1)}" stroke="${INK}" stroke-opacity="0.8" stroke-width="${sw}"/>`;
  g += `<path d="M${(-s * 0.46).toFixed(1)},${(-s * 0.16).toFixed(1)} L0,${top.toFixed(1)} L${(s * 0.46).toFixed(1)},${(-s * 0.16).toFixed(1)}" fill="none" stroke="${INK}" stroke-opacity="0.85" stroke-width="${sw}" stroke-linejoin="round"/>`;
  return g;
}
