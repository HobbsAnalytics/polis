import { it, expect } from '../testkit.ts';
import { DEFAULT_SETTINGS } from './settings.ts';

it('default settings include upkeep tunables', () => {
  expect(DEFAULT_SETTINGS.upkeepDailyGain).toBe(0.012);
  expect(DEFAULT_SETTINGS.overdueErosionBase).toBe(0.03);
  expect(DEFAULT_SETTINGS.overdueGrowthPerDay).toBe(0.15);
  expect(DEFAULT_SETTINGS.overdueGrowthCapDays).toBe(14);
});
