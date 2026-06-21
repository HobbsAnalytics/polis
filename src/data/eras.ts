// =============================================================================
// LIFE ERAS — Age-of-Empires-flavored stages of life, mapped to age ranges.
// City-level: the current era is derived from the player's age. Editable.
// =============================================================================

export interface EraDef {
  id: string;
  name: string;
  stage: string;
  startAge: number;
  endAge: number; // inclusive
  color: string;
}

export const LIFE_ERAS: EraDef[] = [
  { id: 'wonder', name: 'Age of Wonder', stage: 'Early childhood', startAge: 0, endAge: 5, color: '#fcd34d' },
  { id: 'discovery', name: 'Age of Discovery', stage: 'School-age years', startAge: 6, endAge: 17, color: '#86efac' },
  { id: 'forging', name: 'Age of Forging', stage: 'Advanced training', startAge: 18, endAge: 24, color: '#67e8f9' },
  { id: 'ascent', name: 'Age of Ascent', stage: 'Early family & career', startAge: 25, endAge: 37, color: '#93c5fd' },
  { id: 'dominion', name: 'Age of Dominion', stage: 'Mid family & career', startAge: 38, endAge: 50, color: '#c4b5fd' },
  { id: 'stewardship', name: 'Age of Stewardship', stage: 'Late family & career', startAge: 51, endAge: 65, color: '#f0abfc' },
  { id: 'legacy', name: 'Age of Legacy', stage: 'Retirement', startAge: 66, endAge: 75, color: '#fda4af' },
];
