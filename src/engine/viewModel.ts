import type {
  CityState,
  CityViewModel,
  ConditionLabel,
  DistrictVM,
  GenericBuildingVM,
  LandmarkVM,
} from './types.ts';

export function conditionLabel(c: number): ConditionLabel {
  if (c >= 0.8) return 'pristine';
  if (c >= 0.55) return 'worn';
  if (c >= 0.3) return 'crumbling';
  if (c >= 0.1) return 'on fire';
  return 'ruin';
}

/**
 * Generic buildings are a pure reflection of district health: their count scales
 * with health (a thriving district sprawls; a dying one loses buildings), and each
 * shares the district's condition.
 */
function genericBuildings(health: number, max: number): GenericBuildingVM[] {
  const count = health <= 0 ? 0 : Math.max(1, Math.round(health * max));
  const label = conditionLabel(health);
  return Array.from({ length: count }, () => ({ condition: health, label }));
}

export function buildCityViewModel(state: CityState): CityViewModel {
  const districts: DistrictVM[] = state.districts.map((d) => {
    const landmarks: LandmarkVM[] = state.landmarks
      .filter((lm) => lm.districtId === d.id)
      .map((lm) => ({
        id: lm.id,
        name: lm.name,
        condition: lm.condition,
        label: conditionLabel(lm.condition),
        tier: lm.tier,
      }));
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      health: d.health,
      generic: genericBuildings(d.health, state.settings.maxGenericBuildings),
      landmarks,
    };
  });
  return { day: state.day, districts };
}
