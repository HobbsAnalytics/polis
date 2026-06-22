import { it, expect } from '../testkit.ts';
import { tileImage } from './tiles.ts';

const table = {
  'generic/ruin': 'tiles/house_ruin.png',
  'd1/generic/ruin': 'tiles/d1_house_ruin.png',
  landmark: 'tiles/landmark.png',
};

it('resolves most-specific match first', () => {
  expect(tileImage({ kind: 'generic', conditionLabel: 'ruin', districtId: 'd1' }, table)).toBe('tiles/d1_house_ruin.png');
});

it('falls back to kind+condition, then kind', () => {
  expect(tileImage({ kind: 'generic', conditionLabel: 'ruin', districtId: 'd2' }, table)).toBe('tiles/house_ruin.png');
  expect(tileImage({ kind: 'landmark', conditionLabel: 'pristine', districtId: 'd9' }, table)).toBe('tiles/landmark.png');
});

it('returns null when nothing matches', () => {
  expect(tileImage({ kind: 'generic', conditionLabel: 'pristine', districtId: 'dX' }, table)).toBeNull();
});

it('"on fire" maps to the onfire slug', () => {
  const t = { 'generic/onfire': 'tiles/fire.png' };
  expect(tileImage({ kind: 'generic', conditionLabel: 'on fire', districtId: 'd1' }, t)).toBe('tiles/fire.png');
});
