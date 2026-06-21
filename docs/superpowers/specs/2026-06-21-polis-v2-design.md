# Polis v2 — Design Spec (catalog, boroughs, roll-up, maturity, removal cooldown)

**Date:** 2026-06-21
**Status:** Approved; builds on `2026-06-20-polis-design.md`.

Eight changes to the Stage-1 engine + UI. The engine stays a pure-TS module emitting
a serializable view model; the React UI consumes only that view model.

## 1. Habit catalog file

`src/data/catalog.ts` is the human-editable source of the default world, exporting
`DISTRICTS`, `BOROUGHS`, and `HABITS`. Each habit declares `name`, `kind`
(good/bad), `weight` (number, default 1), and `target`. `seed.ts` builds the
starting `CityState` from this file. Runtime-created habits/landmarks persist in
localStorage (the file is defaults only; a static app cannot write back to it).

## 2. Data model changes

```ts
type NodeKind = 'district' | 'borough' | 'landmark';
interface TargetRef { kind: NodeKind; id: string; }

interface Habit {
  id: string; name: string; kind: 'good' | 'bad'; weight: number;
  target: TargetRef;
  createdAtISO: string;
  pendingRemovalSinceISO?: string; // set when removal requested
}
interface District {
  id: string; name: string; description: string;
  healthDirect: number;            // 0..1, driven by habits targeting the district directly
  maturity: number;                // >=0, unbounded, sticky
  features: string[];              // unlocked feature ids, sticky
}
interface Borough {
  id: string; districtId: string; name: string;
  healthDirect: number;            // 0..1, driven by habits targeting the borough directly
}
interface Landmark {
  id: string; districtId: string; boroughId: string | null; name: string;
  condition: number; tier: number; tierProgress: number; createdDay: number;
}
interface CityState {
  version: number; day: number; settings: Settings;
  districts: District[]; boroughs: Borough[]; landmarks: Landmark[];
  habits: Habit[]; history: DayRecord[];
}
```

`version` gates persistence: a loaded save whose `version` ≠ current re-seeds.

## 3. Daily update (weight-scaled)

Per scalar node (district.healthDirect, borough.healthDirect, landmark.condition),
once per day, over habits whose `target` is that node:
```
delta = -entropyPerDay
for each good habit g: completed ? delta += goodHabitGain * g.weight
                                : delta -= (checkedIn ? missedHabitPenalty : missedCheckinPenalty) * g.weight
for each bad habit  b: logged   ? delta -= badHabitPenalty * b.weight
clamp(scalar + delta, 0, 1)
```
A habit with `pendingRemovalSinceISO` set is still active (it affects the city until
removal is confirmed).

## 4. Health roll-up (weighted by association count)

Pure functions used by both engine (maturity) and view model (display):
- `nodeWeight(landmark)` = `max(1, #habits targeting it)`
- `nodeWeight(boroughDirect)` = `#habits targeting the borough directly`
- `boroughHealth(borough)` = weighted avg of `{healthDirect, weight=boroughDirectWeight}`
  plus each child landmark `{condition, weight=nodeWeight(lm)}`; fall back to
  `healthDirect` if total weight 0.
- `boroughWeight(borough)` = `#habits anywhere under the borough` + `#landmarks in borough`
- `districtHealth(district)` = weighted avg of:
  `{healthDirect, weight=#habits targeting district directly}`,
  each borough `{boroughHealth, weight=boroughWeight}`,
  each directly-attached landmark `{condition, weight=nodeWeight(lm)}`;
  fall back to `healthDirect` if total weight 0.

## 5. Buildings (uncapped) + maturity + features

- **Live buildings** = `round(districtHealth * BASE_SPREAD)` — responsive to current
  health (neglect thins them).
- **Legacy buildings** = `floor(maturity)` — permanent, unbounded.
- Generic building count = live + legacy; every generic building's condition =
  current districtHealth (decay shows as color, not disappearance).
- **Maturity**: each day, if `districtHealth >= maturityThreshold` (pristine, 0.8),
  `maturity += maturityGainPerDay`. Sticky (never decreases).
- **Features**: `FEATURES` table maps maturity milestones to named features
  (Fountain@1, Park@3, Library@6, Market@10, Gardens@15). When `floor(maturity)`
  crosses a milestone, the feature id is appended to `district.features` (sticky).

## 6. View model additions

```ts
interface FeatureVM { id: string; name: string; emoji: string; }
interface BoroughVM { id: string; name: string; health: number; label: ConditionLabel; landmarks: LandmarkVM[]; }
interface DistrictVM {
  id; name; description; health; label;
  maturity: number;
  generic: GenericBuildingVM[];           // live + legacy, all at condition=health
  features: FeatureVM[];
  boroughs: BoroughVM[];
  landmarks: LandmarkVM[];                 // directly attached (no borough)
}
```

## 7. Removal cooldown (real calendar days)

- `requestHabitRemoval(state, habitId)` sets `pendingRemovalSinceISO = todayISO`.
- `cancelHabitRemoval(state, habitId)` clears it.
- `confirmHabitRemoval(state, habitId, todayISO)` removes the habit **only if**
  ≥ `REMOVAL_COOLDOWN_DAYS` (2) calendar days have elapsed since the request; else
  it is a no-op (returns state unchanged). Day math (today vs request date) is passed
  in from the UI so the engine stays clock-free.
- UI shows the "Past/Present/Future Joseph" message + countdown; "Confirm removal"
  enables only after the cooldown; "Cancel" always available.

## 8. UI

- **Habit Catalog panel**: list all habits (name, kind, weight, resolved district);
  create-habit form (name, kind, weight, target picker over districts/boroughs/
  landmarks); per-habit Remove → cooldown flow.
- **Create landmark**: name + district + optional borough + multi-select of existing
  good/bad catalog habits to attach (≥1 good required). No free text.
- **District card**: district health bar + maturity; feature badges; borough
  sub-sections (each with health bar + its landmarks); directly-attached landmarks;
  uncapped neighborhood chips.
- Temporary dev time-travel panel stays.

## Settings additions

`weight` defaults 1; `BASE_SPREAD = 12`; `maturityThreshold = 0.8`;
`maturityGainPerDay = 0.15`; `REMOVAL_COOLDOWN_DAYS = 2`; `FEATURES` milestones as above.

## Out of scope

Borough-level maturity/features (district-level only for now); landmark removal
cooldown (mechanism reusable later); intensity habits; backfill; backend/sync.

## Testing

Engine tests extend to: weight scaling, weighted roll-up (district reflects a
thriving borough/landmark proportionally to its size), maturity accrual + feature
unlock, removal request/confirm gating. Then verify the loop in a real browser.
