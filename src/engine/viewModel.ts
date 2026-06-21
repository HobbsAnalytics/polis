import type {
  CityState,
  CityViewModel,
  ConditionLabel,
  DistrictVM,
  FeatureVM,
  GenericBuildingVM,
  Landmark,
  LandmarkVM,
} from './types.ts';
import { FEATURES } from './settings.ts';
import { boroughHealth, districtHealth } from './rollup.ts';

export function conditionLabel(c: number): ConditionLabel {
  if (c >= 0.8) return 'pristine';
  if (c >= 0.55) return 'worn';
  if (c >= 0.3) return 'crumbling';
  if (c >= 0.1) return 'on fire';
  return 'ruin';
}

/**
 * Live buildings scale with current health (responsive to neglect); legacy
 * buildings accumulate with maturity and never disappear. No cap. Every building
 * shows the district's current condition, so decay reads as color, not vanishing.
 */
function genericBuildings(health: number, maturity: number, baseSpread: number): GenericBuildingVM[] {
  const live = Math.round(health * baseSpread);
  const legacy = Math.floor(maturity);
  const label = conditionLabel(health);
  return Array.from({ length: live + legacy }, () => ({ condition: health, label }));
}

function featureVMs(ids: string[]): FeatureVM[] {
  return FEATURES.filter((f) => ids.includes(f.id)).map((f) => ({ id: f.id, name: f.name, emoji: f.emoji }));
}

function toLandmarkVM(lm: Landmark): LandmarkVM {
  return {
    id: lm.id,
    name: lm.name,
    condition: lm.condition,
    label: conditionLabel(lm.condition),
    tier: lm.tier,
  };
}

export function buildCityViewModel(state: CityState): CityViewModel {
  const districts: DistrictVM[] = state.districts.map((d) => {
    const health = districtHealth(state, d);
    const boroughs = state.boroughs
      .filter((b) => b.districtId === d.id)
      .map((b) => {
        const bHealth = boroughHealth(state, b);
        return {
          id: b.id,
          name: b.name,
          health: bHealth,
          label: conditionLabel(bHealth),
          landmarks: state.landmarks.filter((l) => l.boroughId === b.id).map(toLandmarkVM),
        };
      });
    const landmarks = state.landmarks
      .filter((l) => l.districtId === d.id && l.boroughId === null)
      .map(toLandmarkVM);
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      health,
      label: conditionLabel(health),
      maturity: d.maturity,
      generic: genericBuildings(health, d.maturity, state.settings.baseSpread),
      features: featureVMs(d.features),
      boroughs,
      landmarks,
    };
  });
  return { day: state.day, districts };
}
