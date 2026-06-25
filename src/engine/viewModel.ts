import type {
  CityState,
  CityViewModel,
  ConditionLabel,
  DistrictVM,
  FeatureVM,
  GenericBuildingVM,
  Landmark,
  LandmarkVM,
  Neighborhood,
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

/**
 * The Patina health ramp — the single health→material function (design system §3).
 * Maps h ∈ [0,1] to a weathered-material color: ashen ruin → oxide → weathered
 * stone → faint sage → verdigris. Drives every condition surface (tiles, pips,
 * bars, legend) so the app and any generated tile art share one definition.
 */
const RAMP_STOPS: [number, [number, number, number]][] = [
  [0.0, [110, 99, 91]], // #6E635B ashen — ruin
  [0.22, [171, 107, 80]], // #AB6B50 oxide — failing ("on fire")
  [0.46, [185, 182, 166]], // #B9B6A6 weathered stone — crumbling
  [0.63, [157, 179, 159]], // #9DB39F faint sage — worn
  [1.0, [95, 142, 120]], // #5F8E78 verdigris — pristine
];

export function ramp(h: number): string {
  const x = Math.max(0, Math.min(1, h));
  for (let i = 1; i < RAMP_STOPS.length; i++) {
    if (x <= RAMP_STOPS[i][0]) {
      const [t0, c0] = RAMP_STOPS[i - 1];
      const [t1, c1] = RAMP_STOPS[i];
      const f = (x - t0) / (t1 - t0);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * f));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  const c = RAMP_STOPS[RAMP_STOPS.length - 1][1];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Representative health for each condition label → its single point on the ramp. */
const LABEL_HEALTH: Record<ConditionLabel, number> = {
  pristine: 1,
  worn: 0.63,
  crumbling: 0.46,
  'on fire': 0.22,
  ruin: 0,
};

export const CONDITIONS: ConditionDef[] = [
  { label: 'pristine', min: 0.8, slug: 'pristine', color: ramp(LABEL_HEALTH.pristine) },
  { label: 'worn', min: 0.55, slug: 'worn', color: ramp(LABEL_HEALTH.worn) },
  { label: 'crumbling', min: 0.3, slug: 'crumbling', color: ramp(LABEL_HEALTH.crumbling) },
  { label: 'on fire', min: 0.1, slug: 'onfire', color: ramp(LABEL_HEALTH['on fire']) },
  { label: 'ruin', min: 0, slug: 'ruin', color: ramp(LABEL_HEALTH.ruin) },
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

/** Map fill color for a condition label — its point on the Patina health ramp. */
export function conditionColor(label: ConditionLabel): string {
  return ramp(LABEL_HEALTH[label]);
}

/**
 * One building per neighborhood, each rendered at its own condition — so a
 * district reads as a patchwork: some blocks pristine, others crumbling.
 */
function genericBuildings(neighborhoods: Neighborhood[]): GenericBuildingVM[] {
  return neighborhoods.map((n) => ({ id: n.id, condition: n.health, label: conditionLabel(n.health) }));
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
          generic: genericBuildings(state.neighborhoods.filter((n) => n.boroughId === b.id)),
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
      generic: genericBuildings(state.neighborhoods.filter((n) => n.districtId === d.id && n.boroughId === null)),
      features: featureVMs(d.features),
      boroughs,
      landmarks,
    };
  });
  return { day: state.day, districts };
}
