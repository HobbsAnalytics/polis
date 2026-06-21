import { it, expect } from '../testkit.ts';
import { conditionLabel, buildCityViewModel } from './viewModel.ts';
import { createCity, addLandmark, addHabit } from './engine.ts';
import type { District } from './types.ts';

it('condition labels respect thresholds', () => {
  expect(conditionLabel(0.9)).toBe('pristine');
  expect(conditionLabel(0.8)).toBe('pristine');
  expect(conditionLabel(0.6)).toBe('worn');
  expect(conditionLabel(0.4)).toBe('crumbling');
  expect(conditionLabel(0.15)).toBe('on fire');
  expect(conditionLabel(0.05)).toBe('ruin');
  expect(conditionLabel(0)).toBe('ruin');
});

it('district at health 1 yields max generic buildings; at 0 yields none', () => {
  const full: District = { id: 'd1', name: 'D', description: '', health: 1 };
  const empty: District = { id: 'd2', name: 'E', description: '', health: 0 };
  const s = createCity({ districts: [full, empty] });
  const vm = buildCityViewModel(s);
  expect(vm.districts[0].generic.length).toBe(s.settings.maxGenericBuildings);
  expect(vm.districts[1].generic.length).toBe(0);
});

it('landmark VM carries tier and label and lands in its district', () => {
  const d: District = { id: 'd1', name: 'D', description: '', health: 0.5 };
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'Cathedral', condition: 0.9 });
  s = addHabit(r.state, { id: 'h', name: 'x', kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  const vm = buildCityViewModel(s);
  expect(vm.districts[0].landmarks).toHaveLength(1);
  expect(vm.districts[0].landmarks[0].name).toBe('Cathedral');
  expect(vm.districts[0].landmarks[0].label).toBe('pristine');
  expect(vm.districts[0].landmarks[0].tier).toBe(0);
});
