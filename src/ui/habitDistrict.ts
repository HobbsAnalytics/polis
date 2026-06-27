import type { CityState, District, Habit } from '../engine/types.ts';
import { habitStatus } from '../engine/cadence.ts';

export function habitDistrictId(city: CityState, habit: Habit): string | null {
  if (habit.target.kind === 'borough') {
    return city.boroughs.find((b) => b.id === habit.target.id)?.districtId ?? null;
  }
  return city.landmarks.find((l) => l.id === habit.target.id)?.districtId ?? null;
}

export function habitsForDistrict(city: CityState, districtId: string): Habit[] {
  return city.habits.filter((h) => habitDistrictId(city, h) === districtId);
}

export function districtsWithHabits(city: CityState): District[] {
  const ids = new Set(city.habits.map((h) => habitDistrictId(city, h)).filter(Boolean) as string[]);
  return city.districts.filter((d) => ids.has(d.id));
}

export function districtBadgeCount(city: CityState, districtId: string, todayISO: string): number {
  return habitsForDistrict(city, districtId).filter((h) => {
    if (h.kind !== 'good') return false;
    const st = habitStatus({ cadence: h.cadence, anchorISO: h.lastCompletedISO ?? h.createdAtISO, todayISO });
    return st.state === 'overdue' || st.state === 'dueToday';
  }).length;
}
