// Pure weighted health roll-up, shared by the engine (maturity) and the view
// model (display). Lower levels roll up into the district, weighted by how many
// habits/landmarks are associated with each contributor.
import type { Borough, CityState, District, Habit, NodeKind } from './types.ts';

export function habitsTargeting(habits: Habit[], kind: NodeKind, id: string): Habit[] {
  return habits.filter((h) => h.target.kind === kind && h.target.id === id);
}

interface Part {
  value: number;
  weight: number;
}

function weightedAvg(parts: Part[], fallback: number): number {
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  if (totalWeight <= 0) return fallback;
  return parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight;
}

/** A landmark's association weight: how many habits feed it (at least 1). */
export function landmarkWeight(state: CityState, landmarkId: string): number {
  return Math.max(1, habitsTargeting(state.habits, 'landmark', landmarkId).length);
}

export function boroughHealth(state: CityState, borough: Borough): number {
  const directHabits = habitsTargeting(state.habits, 'borough', borough.id);
  const parts: Part[] = [{ value: borough.healthDirect, weight: directHabits.length }];
  for (const lm of state.landmarks.filter((l) => l.boroughId === borough.id)) {
    parts.push({ value: lm.condition, weight: landmarkWeight(state, lm.id) });
  }
  return weightedAvg(parts, borough.healthDirect);
}

/** A borough's association weight: habits anywhere under it + its landmarks. */
export function boroughWeight(state: CityState, borough: Borough): number {
  const landmarks = state.landmarks.filter((l) => l.boroughId === borough.id);
  const habitCount =
    habitsTargeting(state.habits, 'borough', borough.id).length +
    landmarks.reduce((s, lm) => s + habitsTargeting(state.habits, 'landmark', lm.id).length, 0);
  return habitCount + landmarks.length;
}

export function districtHealth(state: CityState, district: District): number {
  const directHabits = habitsTargeting(state.habits, 'district', district.id);
  const parts: Part[] = [{ value: district.healthDirect, weight: directHabits.length }];
  for (const b of state.boroughs.filter((x) => x.districtId === district.id)) {
    parts.push({ value: boroughHealth(state, b), weight: boroughWeight(state, b) });
  }
  for (const lm of state.landmarks.filter((l) => l.districtId === district.id && l.boroughId === null)) {
    parts.push({ value: lm.condition, weight: landmarkWeight(state, lm.id) });
  }
  return weightedAvg(parts, district.healthDirect);
}
