import { useState, type MouseEvent, type ReactNode } from 'react';

interface Tip {
  text: string;
  x: number;
  y: number;
}

interface Tooltip {
  /** Spread onto the container whose descendants carry `data-info`. */
  handlers: {
    onMouseMove: (e: MouseEvent) => void;
    onMouseLeave: () => void;
  };
  /** The floating tooltip node; render it once near the container. */
  tooltip: ReactNode;
}

/**
 * Cursor-following tooltip driven by a `data-info` attribute. One delegated
 * mousemove walks up to the nearest `selector` match and shows its text, so a
 * grid of thousands of cells needs no per-cell handlers. Shared by the hex map
 * and the life-in-weeks grid.
 */
export function useTooltip(selector: string, maxWidth = 260): Tooltip {
  const [tip, setTip] = useState<Tip | null>(null);
  const handlers = {
    onMouseMove: (e: MouseEvent) => {
      const el = (e.target as Element).closest(selector);
      const info = el?.getAttribute('data-info');
      setTip(info ? { text: info, x: e.clientX, y: e.clientY } : null);
    },
    onMouseLeave: () => setTip(null),
  };
  const tooltip = tip ? (
    <div className="week-tip" style={{ left: Math.min(tip.x + 14, window.innerWidth - maxWidth), top: tip.y + 14 }}>
      {tip.text}
    </div>
  ) : null;
  return { handlers, tooltip };
}
