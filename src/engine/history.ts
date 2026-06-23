// Read-only reconstruction of a past day from its activity-log snapshot.
// A snapshot records each building's health and each landmark's condition for
// one day. Overlaying it onto the current city — and dropping entities that
// didn't exist yet (absent from the snapshot) — yields a faithful past state
// for the City/Map views to render. District/borough health re-derives from the
// roll-up of those leaves, so colors reflect that day. Maturity-driven features
// are not snapshotted and simply show their current set (a known limitation).
import type { CityState, DaySnapshot } from './types.ts';

export function cityAtSnapshot(base: CityState, snap: DaySnapshot): CityState {
  const health = new Map(snap.neighborhoods);
  const condition = new Map(snap.landmarks);
  return {
    ...base,
    neighborhoods: base.neighborhoods
      .filter((n) => health.has(n.id))
      .map((n) => ({ ...n, health: health.get(n.id) as number })),
    landmarks: base.landmarks
      .filter((l) => condition.has(l.id))
      .map((l) => ({ ...l, condition: condition.get(l.id) as number })),
  };
}
