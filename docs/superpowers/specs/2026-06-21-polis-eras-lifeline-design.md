# Polis — Eras + "Life in Weeks" page

**Date:** 2026-06-21
**Status:** Approved; builds on v2.

A city-level **Era** (life stage derived from the player's age) and a second page
visualizing the player's life as a grid of weeks.

## 1. Profile (city-level state)

Add to `CityState`:
```ts
interface Profile { birthDateISO: string; lifespanYears: number; }
// CityState gains: profile: Profile
```
Default `DEFAULT_PROFILE = { birthDateISO: '1988-11-01', lifespanYears: 75 }` (in
settings.ts). Editable on the Life page via `setProfile(state, profile)`.

Bump `CITY_VERSION` 2 → 3. `loadCity` migrates a v2 save by backfilling the default
profile and setting version 3 (preserves the city; does not wipe it).

## 2. Eras (`src/data/eras.ts`)

```ts
interface EraDef { id: string; name: string; stage: string; startAge: number; endAge: number; color: string; }
```
Seven eras (editable), Age-of-Empires-flavored:

| id | name | stage | ages |
|---|---|---|---|
| wonder | Age of Wonder | Early childhood | 0–5 |
| discovery | Age of Discovery | School-age years | 6–17 |
| forging | Age of Forging | Advanced training | 18–24 |
| ascent | Age of Ascent | Early family & career | 25–37 |
| dominion | Age of Dominion | Mid family & career | 38–50 |
| stewardship | Age of Stewardship | Late family & career | 51–65 |
| legacy | Age of Legacy | Retirement | 66–75 |

Current era is derived (not stored).

## 3. Lifeline logic (`src/engine/lifeline.ts`, pure)

```ts
weeksLived(birthDateISO: string, todayISO: string): number      // floor(days/7), min 0
ageYears(weeksLived: number): number                            // floor(weeksLived/52)
currentEra(age: number, eras: EraDef[]): EraDef                 // range match; clamp to last
interface WeekCellVM { index: number; status: 'lived' | 'current' | 'future'; }
interface LifelineVM {
  totalWeeks: number; weeksLived: number; weeksLeft: number;
  age: number; currentEraId: string;
  years: { yearIndex: number; eraId: string; eraStart: boolean; weeks: WeekCellVM[] }[];
}
buildLifeline(profile: Profile, todayISO: string, eras: EraDef[]): LifelineVM
```
- `totalWeeks = lifespanYears * 52`.
- A week at index `i`: `lived` if `i < weeksLived`, `current` if `i === weeksLived`,
  else `future`.
- Each year row has 52 week cells; `eraId` = era covering that year's age;
  `eraStart` = true on the first year of an era (where the band label prints).

## 4. Navigation

App holds `page: 'city' | 'life'` in state. Header shows two tabs. No router lib.

## 5. City page

Adds an era banner under the title: `"{era.name} · {era.stage} · age {age} · week {n} of {total}"`.

## 6. Life page (`src/ui/LifePage.tsx`)

- Grid: 52 boxes per row, 75 rows, extra gap after every 5th row.
- Box color: lived = grey, current = green, future = white (outline).
- Era bands: a colored left border per era on each of its year rows; the era name
  prints on the first year of the era (`eraStart`). Boxes stay monochrome.
- Legend: era → age range, current era highlighted.
- Summary: "X weeks lived · Y weeks left · Z% remaining".
- Profile editor: birthday (date input) + lifespan (number) → `setProfile`.

## 7. Out of scope

Era-driven restyling of districts/buildings (deferred to Stage 2/3); precise
month/day era boundaries (uses whole-year ages); leap-week nuance (fixed 52/year).

## 8. Testing

`lifeline.test.ts`: weeksLived for a known birth/today; ageYears; currentEra at
range boundaries and beyond-lifespan clamp; buildLifeline totals
(lived + current + future = totalWeeks; weeksLived + weeksLeft relationship).
`storage.test.ts`: a v2 save (no profile) loads migrated to v3 with a profile.
Then verify both pages in a real browser.
