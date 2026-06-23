import { it, expect } from '../testkit.ts';
import { buildCityscape, hexSpiral } from './cityscape.ts';
import { buildCityViewModel } from './viewModel.ts';
import { createSeededCity } from './seed.ts';
import { applyCheckIn } from './engine.ts';

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
