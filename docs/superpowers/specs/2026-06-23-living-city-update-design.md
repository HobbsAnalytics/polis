# Living-city update — design

Date: 2026-06-23
Status: Approved

A batch of seven interrelated changes to Polis. The linchpin is making
neighborhoods individually-lived entities; the map rewrite, audit log, and
week-box coloring all build on it.

## 1. Day counter anchored to the real calendar (#1)

- Add `Profile.startDateISO` (nullable / empty until set).
- Set it the first time `profile.name` becomes non-empty.
- Displayed day = `dayDiffISO(startDateISO, todayISO)`; the day you set your
  name is **Day 1**. Before a name is set the header shows **Day 0** with a
  nudge to set a name on the Profile tab.
- Internal `state.day` continues to advance via the existing catch-up path and
  stays in sync; display reads from the calendar so it can never get stuck.

## 2/3. Contiguous hex city map (#2, #3)

Replace the left-to-right packing in `cityscape.ts` with:

1. Total tile count = sum of all neighborhoods + landmarks + features.
2. Generate one roughly-circular hex disc of that size (spiral).
3. Assign cells to districts via **multi-source BFS region-growing** from
   district seed points arranged in a ring → each district is a contiguous
   blob sized by its tile count.
4. Sub-partition each district's cells into contiguous borough regions the same
   way; remaining cells are district-direct.
5. Map each cell to one neighborhood / landmark / feature; color by that
   entity's individual health/condition.

Deterministic via a seeded PRNG (mulberry32) so the map is stable day to day
(it recolors, doesn't reshuffle) and grows as the city grows.

Boroughs render as **traced boundary outlines + subtle tint + label** inside
their district region.

## 4. Neighborhoods become persistent entities (foundation)

```ts
interface Neighborhood {
  id: string;
  districtId: string;
  boroughId: string | null;
  health: number;     // 0..1, drifts individually
  createdDay: number;
}
```

- `CityState.neighborhoods: Neighborhood[]` (flat, like the other arrays).
- **Migration/seed:** generate neighborhoods per district from its current
  building count (round-robin into boroughs where present, else district-direct),
  each initialized to the district's current health.
- **Daily sim:** each neighborhood decays via entropy with a deterministic
  per-building variance factor derived from its id, so identical habits still
  make buildings diverge over time. A completed good habit targeting a
  district/borough spreads `weight × gain` across that district/borough's
  neighborhoods; missed/bad habits subtract. Landmarks keep per-landmark
  `condition`.
- **Roll-up:** `boroughHealth` = avg(its neighborhoods + landmarks);
  `districtHealth` = avg(its neighborhoods + boroughs + landmarks).
  `healthDirect` retained only as the empty-district fallback.
- Count is stable day to day; grows slowly with maturity (preserving today's
  legacy-building accumulation).

## 5. Daily activity log + history view (#5)

```ts
interface DayLog {
  day: number;
  dateISO: string;
  checkedIn: boolean;
  completedHabitIds: string[];
  loggedBadHabitIds: string[];
  netHealthChange: number;       // sum of all node deltas that day
  snapshot: {
    neighborhoods: [string, number][];  // [id, health]
    landmarks: [string, number][];      // [id, condition]
  };
}
```

- `CityState.log: DayLog[]`, one record appended per advanced day. Included in
  JSON export.
- **History view** (replaces the dev time-travel panel): step prev/next through
  days and render City/Map read-only from each snapshot.

## 6. Week-box color from aggregate change (#6)

On the Life tab, color each lived week's box by the summed `netHealthChange` of
its days: clearly up → green, slightly up → light green, flat → neutral,
slightly down → yellow, down → red. Weeks with no activity keep the default
lived/current/future styling.

## 7. Habit weight dropdown (#7)

Replace the numeric weight input in `HabitCatalog.tsx` with a select:
**Somewhat important (1) / Important (2) / Very important (3)**. Stored as the
same numeric weight; existing weights > 3 display as "Very important".

## Implementation order

neighborhoods model → day counter + weight dropdown → audit log → map rewrite →
week colors → history view.
