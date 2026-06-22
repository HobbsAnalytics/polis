import type { CityState } from './types.ts';
import { createCity, addDistrict } from './engine.ts';

/**
 * Builds the initial CityState for a brand-new save: a minimal scaffold.
 * Blank profile name, a single starter district named "Home" (the user renames
 * it in the Profile tab), and no boroughs, habits, or landmarks.
 */
export function createSeededCity(): CityState {
  return addDistrict(createCity(), { name: 'Home' }).state;
}
