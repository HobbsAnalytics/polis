import { it, expect } from '../testkit.ts';
import { buildCityscape, hexSpiral } from './cityscape.ts';
import { buildCityViewModel } from './viewModel.ts';
import { createCity, addLandmark, applyCheckIn } from './engine.ts';
import { createSeededCity } from './seed.ts';
import type { District } from './types.ts';

it('hexSpiral returns n unique coordinates starting at center', () => {
  const s = hexSpiral(20);
  expect(s).toHaveLength(20);
  expect(s[0]).toEqual({ q: 0, r: 0 });
  const keys = new Set(s.map((c) => `${c.q},${c.r}`));
  expect(keys.size).toBe(20);
});

it('tile count equals generics + landmarks (incl. borough) + features', () => {
  const vm = buildCityViewModel(createSeededCity());
  const expected = vm.districts.reduce((sum, d) => {
    const landmarks = d.landmarks.length + d.boroughs.reduce((b, x) => b + x.landmarks.length, 0);
    const boroughGeneric = d.boroughs.reduce((b, x) => b + x.generic.length, 0);
    return sum + d.generic.length + boroughGeneric + landmarks + d.features.length;
  }, 0);
  expect(buildCityscape(vm).tiles).toHaveLength(expected);
});

it('each tile carries the raw health of its source entity (drives the ramp)', () => {
  const dist = (id: string): District => ({ id, name: id, description: '', healthDirect: 0.5, maturity: 0, features: [] });
  let s = createCity({
    districts: [dist('d1')],
    boroughs: [{ id: 'b1', districtId: 'd1', name: 'B', healthDirect: 0.5 }],
    neighborhoods: [{ id: 'n1', districtId: 'd1', boroughId: 'b1', health: 0.37, createdDay: 0 }],
  });
  s = addLandmark(s, { districtId: 'd1', boroughId: 'b1', name: 'L', condition: 0.91 }).state;
  const tiles = buildCityscape(buildCityViewModel(s)).tiles;
  const generic = tiles.find((t) => t.kind === 'generic');
  const landmark = tiles.find((t) => t.kind === 'landmark');
  expect(generic?.health).toBe(0.37);
  expect(landmark?.health).toBe(0.91);
});

it('layout is deterministic and tiles never share a coordinate', () => {
  // advance a few days so districts differ in size
  let s = createSeededCity();
  const good = s.habits.filter((h) => h.kind === 'good').map((h) => h.id);
  for (let i = 0; i < 12; i++) s = applyCheckIn(s, { completedHabitIds: good, loggedBadHabitIds: [] });
  const vm = buildCityViewModel(s);

  const a = buildCityscape(vm);
  const b = buildCityscape(vm);
  expect(a).toEqual(b);

  const coords = new Set(a.tiles.map((t) => `${Math.round(t.x)},${Math.round(t.y)}`));
  expect(coords.size).toBe(a.tiles.length);
  expect(a.width).toBeGreaterThan(0);
  expect(a.height).toBeGreaterThan(0);
});
