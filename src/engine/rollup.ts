// Pure weighted health roll-up, shared by the engine (maturity) and the view
// model (display). Buildings (neighborhoods) and landmarks are the leaves;
// boroughs aggregate the leaves under them, and districts aggregate their direct
// buildings, their boroughs, and their direct landmarks. `healthDirect` survives
// only as a fallback for a container that has no leaves yet.
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
  const parts: Part[] = [];
  for (const n of state.neighborhoods.filter((x) => x.boroughId === borough.id)) {
    parts.push({ value: n.health, weight: 1 });
  }
  for (const lm of state.landmarks.filter((l) => l.boroughId === borough.id)) {
    parts.push({ value: lm.condition, weight: landmarkWeight(state, lm.id) });
  }
  return weightedAvg(parts, borough.healthDirect);
}

/** A borough's association weight in its district: the count of its buildings + landmarks. */
export function boroughWeight(state: CityState, borough: Borough): number {
  const neighborhoods = state.neighborhoods.filter((n) => n.boroughId === borough.id).length;
  const landmarks = state.landmarks.filter((l) => l.boroughId === borough.id).length;
  return Math.max(1, neighborhoods + landmarks);
}

export function districtHealth(state: CityState, district: District): number {
  const parts: Part[] = [];
  for (const n of state.neighborhoods.filter((x) => x.districtId === district.id && x.boroughId === null)) {
    parts.push({ value: n.health, weight: 1 });
  }
  for (const b of state.boroughs.filter((x) => x.districtId === district.id)) {
    parts.push({ value: boroughHealth(state, b), weight: boroughWeight(state, b) });
  }
  for (const lm of state.landmarks.filter((l) => l.districtId === district.id && l.boroughId === null)) {
    parts.push({ value: lm.condition, weight: landmarkWeight(state, lm.id) });
  }
  return weightedAvg(parts, district.healthDirect);
}
