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

/** Single source of truth for a condition: its threshold, CSS slug, and map color.
 * Ordered high → low; `conditionLabel` picks the first whose `min` is met. */
export interface ConditionDef {
  label: ConditionLabel;
  min: number; // inclusive lower bound on the 0..1 scalar
  slug: string; // CSS class slug (matches public/app.css)
  color: string; // hex fill used by the hex map
}

export const CONDITIONS: ConditionDef[] = [
  { label: 'pristine', min: 0.8, slug: 'pristine', color: '#10b981' },
  { label: 'worn', min: 0.55, slug: 'worn', color: '#84cc16' },
  { label: 'crumbling', min: 0.3, slug: 'crumbling', color: '#f59e0b' },
  { label: 'on fire', min: 0.1, slug: 'onfire', color: '#ea580c' },
  { label: 'ruin', min: 0, slug: 'ruin', color: '#78716c' },
];

const CONDITION_BY_LABEL = Object.fromEntries(CONDITIONS.map((c) => [c.label, c])) as Record<
  ConditionLabel,
  ConditionDef
>;

export function conditionLabel(c: number): ConditionLabel {
  return (CONDITIONS.find((d) => c >= d.min) ?? CONDITIONS[CONDITIONS.length - 1]).label;
}

/** CSS-class slug for a condition label ('on fire' → 'onfire'); '' if absent. */
export function conditionSlug(label?: ConditionLabel): string {
  return label ? CONDITION_BY_LABEL[label].slug : '';
}

/** Map fill color for a condition label. */
export function conditionColor(label: ConditionLabel): string {
  return CONDITION_BY_LABEL[label].color;
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
