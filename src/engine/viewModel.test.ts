import { it, expect } from '../testkit.ts';
import { conditionLabel, conditionColor, ramp, buildCityViewModel } from './viewModel.ts';
import { createCity, addLandmark, addHabit } from './engine.ts';
import type { District, Habit, TargetRef } from './types.ts';

const dist = (id: string, healthDirect = 0.5, maturity = 0): District => ({
  id,
  name: id,
  description: '',
  healthDirect,
  maturity,
  features: [],
});
const hab = (id: string, target: TargetRef): Habit => ({
  id,
  name: id,
  kind: 'good',
  weight: 1,
  target,
  createdAtISO: '2026-01-01',
});

it('ramp maps health to the five material stops, interpolating and clamping', () => {
  // The five stops from the design system (RUIN → PRISTINE).
  expect(ramp(0)).toBe('rgb(110,99,91)'); // ashen
  expect(ramp(0.22)).toBe('rgb(171,107,80)'); // oxide
  expect(ramp(0.46)).toBe('rgb(185,182,166)'); // weathered stone
  expect(ramp(0.63)).toBe('rgb(157,179,159)'); // faint sage
  expect(ramp(1)).toBe('rgb(95,142,120)'); // verdigris
  // linear interpolation halfway between the first two stops (h = 0.11)
  expect(ramp(0.11)).toBe('rgb(141,103,86)');
  // out of range clamps to the endpoints
  expect(ramp(-1)).toBe('rgb(110,99,91)');
  expect(ramp(2)).toBe('rgb(95,142,120)');
});

it('conditionColor maps each label to its ramp stop (no rainbow)', () => {
  expect(conditionColor('pristine')).toBe(ramp(1));
  expect(conditionColor('worn')).toBe(ramp(0.63));
  expect(conditionColor('crumbling')).toBe(ramp(0.46));
  expect(conditionColor('on fire')).toBe(ramp(0.22));
  expect(conditionColor('ruin')).toBe(ramp(0));
});

it('condition labels respect thresholds', () => {
  expect(conditionLabel(0.9)).toBe('pristine');
  expect(conditionLabel(0.8)).toBe('pristine');
  expect(conditionLabel(0.6)).toBe('worn');
  expect(conditionLabel(0.4)).toBe('crumbling');
  expect(conditionLabel(0.15)).toBe('on fire');
  expect(conditionLabel(0.05)).toBe('ruin');
});

it('each neighborhood renders as its own building, at its own condition', () => {
  const s = createCity({
    districts: [dist('d1', 0.5, 20)],
    neighborhoods: [
      { id: 'n1', districtId: 'd1', boroughId: null, health: 0.9, createdDay: 0 },
      { id: 'n2', districtId: 'd1', boroughId: null, health: 0.2, createdDay: 0 },
    ],
  });
  s.districts[0].features = ['fountain'];
  const vm = buildCityViewModel(s);
  expect(vm.districts[0].generic.length).toBe(2);
  const labels = vm.districts[0].generic.map((b) => b.label);
  expect(labels).toContain('pristine'); // the 0.9 building
  expect(labels).toContain('on fire'); // the 0.2 building — a different condition than its neighbor
  expect(vm.districts[0].maturity).toBe(20);
  expect(vm.districts[0].features.map((f) => f.id)).toContain('fountain');
});

it('borough and its landmark surface in the district view, with roll-up', () => {
  let s = createCity({
    districts: [dist('d1', 0.5)],
    boroughs: [{ id: 'b1', districtId: 'd1', name: 'B', healthDirect: 0.5 }],
  });
  const r = addLandmark(s, { districtId: 'd1', boroughId: 'b1', name: 'Cathedral', condition: 0.95 });
  s = addHabit(r.state, hab('h', { kind: 'landmark', id: r.landmarkId }));
  const vm = buildCityViewModel(s);
  expect(vm.districts[0].boroughs).toHaveLength(1);
  expect(vm.districts[0].boroughs[0].landmarks[0].name).toBe('Cathedral');
  expect(vm.districts[0].boroughs[0].health).toBeGreaterThan(0.9); // landmark dominates the borough
  expect(vm.districts[0].landmarks).toHaveLength(0); // it's under the borough, not direct
});
