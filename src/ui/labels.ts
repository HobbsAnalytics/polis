import type { ConditionLabel } from '../engine/types.ts';

/** Maps a condition label to its CSS class slug (defined in public/app.css). */
export function labelSlug(label: ConditionLabel): string {
  return label === 'on fire' ? 'onfire' : label;
}
