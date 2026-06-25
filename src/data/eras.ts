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

// Era band colors are a muted, low-chroma sequence (a quiet hue arc) so the life
// stages stay scannable without competing with the health ramp — the only loud
// thing in the Patina system. Color signals condition; eras read as soft bands.
export const LIFE_ERAS: EraDef[] = [
  { id: 'wonder', name: 'Age of Wonder', stage: 'Early childhood', startAge: 0, endAge: 5, color: '#C7C9B4' },
  { id: 'discovery', name: 'Age of Discovery', stage: 'School-age years', startAge: 6, endAge: 17, color: '#A7B79F' },
  { id: 'forging', name: 'Age of Forging', stage: 'Advanced training', startAge: 18, endAge: 24, color: '#8FA89E' },
  { id: 'ascent', name: 'Age of Ascent', stage: 'Early family & career', startAge: 25, endAge: 37, color: '#8898A4' },
  { id: 'dominion', name: 'Age of Dominion', stage: 'Mid family & career', startAge: 38, endAge: 50, color: '#9591A6' },
  { id: 'stewardship', name: 'Age of Stewardship', stage: 'Late family & career', startAge: 51, endAge: 65, color: '#AC93A2' },
  { id: 'legacy', name: 'Age of Legacy', stage: 'Retirement', startAge: 66, endAge: 75, color: '#B7A096' },
];
