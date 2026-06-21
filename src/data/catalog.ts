// =============================================================================
// HABIT CATALOG — the human-editable source of the default world.
// Lists the starting districts, boroughs, and habits (with their target +
// weight). `seed.ts` builds the initial CityState from this. Runtime-created
// habits/landmarks are layered on top and persisted in localStorage.
// =============================================================================
import type { HabitKind, TargetRef } from '../engine/types.ts';

/** Fixed timestamp for seeded habits (keeps seeding deterministic / clock-free). */
export const SEED_CREATED_ISO = '2026-01-01';

export interface DistrictDef {
  id: string;
  name: string;
  description: string;
}
export interface BoroughDef {
  id: string;
  districtId: string;
  name: string;
}
export interface HabitDef {
  id: string;
  name: string;
  kind: HabitKind;
  weight: number;
  target: TargetRef;
}

export const DISTRICTS: DistrictDef[] = [
  { id: 'd1', name: 'District One', description: 'Placeholder wellbeing domain.' },
  { id: 'd2', name: 'District Two', description: 'Placeholder wellbeing domain.' },
  { id: 'd3', name: 'District Three', description: 'Placeholder wellbeing domain.' },
];

export const BOROUGHS: BoroughDef[] = [
  { id: 'b1', districtId: 'd1', name: 'Sample Borough' },
];

export const HABITS: HabitDef[] = [
  { id: 'h-d1', name: 'Placeholder good habit (District One)', kind: 'good', weight: 1, target: { kind: 'district', id: 'd1' } },
  { id: 'h-b1', name: 'Placeholder good habit (Sample Borough)', kind: 'good', weight: 1, target: { kind: 'borough', id: 'b1' } },
  { id: 'h-d2', name: 'Placeholder good habit (District Two, weight 2)', kind: 'good', weight: 2, target: { kind: 'district', id: 'd2' } },
  { id: 'h-bad-d1', name: 'Placeholder bad habit (District One)', kind: 'bad', weight: 1, target: { kind: 'district', id: 'd1' } },
];

/** Seed landmark (created in seed.ts so it gets a generated id) and its habits. */
export const SEED_LANDMARK = {
  districtId: 'd1',
  boroughId: 'b1' as string | null,
  name: 'Placeholder Landmark',
  goodHabit: { id: 'h-lm-good', name: 'Placeholder good habit (landmark)', weight: 1 },
  badHabit: { id: 'h-lm-bad', name: 'Placeholder bad habit (landmark)', weight: 1 },
};
