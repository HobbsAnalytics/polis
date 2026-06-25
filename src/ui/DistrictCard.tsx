// Reusable detail pieces for the Map's click-to-inspect panel. Given the view
// model + the city's habits, these render a district or a single borough with
// health bars and the habits connected to each borough/landmark (via the
// existing rollup `habitsTargeting`). No engine/data change — just surfacing.
import type { BoroughVM, CityViewModel, ConditionLabel, Habit, LandmarkVM } from '../engine/types.ts';
import { conditionSlug } from '../engine/viewModel.ts';
import { habitsTargeting } from '../engine/rollup.ts';

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** A health bar tinted by the Patina condition ramp (via the cond-* classes). */
export function ConditionBar({ value, label }: { value: number; label?: ConditionLabel }) {
  return (
    <div className="bar bar-lg">
      <div className={`bar-fill cond-${conditionSlug(label)}`} style={{ width: pct(value) }} />
    </div>
  );
}

function HabitLine({ habit }: { habit: Habit }) {
  return (
    <div className="detail-habit">
      <span className={`badge ${habit.kind === 'bad' ? 'tcond-onfire' : 'tcond-pristine'}`}>{habit.kind}</span>
      <span className="detail-habit-name">{habit.name}</span>
      <span className="tier">weight {habit.weight}</span>
    </div>
  );
}

/** The habits attached to a borough or landmark, or a quiet empty note. */
function HabitList({ habits, kind, id }: { habits: Habit[]; kind: 'borough' | 'landmark'; id: string }) {
  const attached = habitsTargeting(habits, kind, id);
  if (attached.length === 0) return <p className="detail-nohabit">no habits connected</p>;
  return (
    <div className="detail-habits">
      {attached.map((h) => (
        <HabitLine key={h.id} habit={h} />
      ))}
    </div>
  );
}

export function LandmarkDetail({ lm, habits }: { lm: LandmarkVM; habits: Habit[] }) {
  return (
    <div className="detail-node detail-landmark">
      <div className="landmark-head">
        <span className="landmark-name">
          ▲ {lm.name} <span className="tier">tier {lm.tier}</span>
        </span>
        <span className={`badge tcond-${conditionSlug(lm.label)}`}>{lm.label}</span>
      </div>
      <ConditionBar value={lm.condition} label={lm.label} />
      <HabitList habits={habits} kind="landmark" id={lm.id} />
    </div>
  );
}

export function BoroughDetail({ borough, habits }: { borough: BoroughVM; habits: Habit[] }) {
  return (
    <div className="detail-node">
      <div className="landmark-head">
        <span className="landmark-name">⌂ {borough.name}</span>
        <span className={`badge tcond-${conditionSlug(borough.label)}`}>{borough.label}</span>
      </div>
      <ConditionBar value={borough.health} label={borough.label} />
      <HabitList habits={habits} kind="borough" id={borough.id} />
      {borough.landmarks.map((lm) => (
        <LandmarkDetail key={lm.id} lm={lm} habits={habits} />
      ))}
    </div>
  );
}

export type Selection = { level: 'district'; id: string } | { level: 'borough'; id: string } | null;

/** The Map's bottom detail panel: a hint at rest, or the selected district/borough. */
export function MapDetailPanel({
  vm,
  habits,
  selection,
  onClear,
}: {
  vm: CityViewModel;
  habits: Habit[];
  selection: Selection;
  onClear: () => void;
}) {
  if (!selection) {
    return (
      <div className="map-detail">
        <p className="map-detail-hint">Select a district or borough to see its health and the habits connected to it.</p>
      </div>
    );
  }

  if (selection.level === 'district') {
    const d = vm.districts.find((x) => x.id === selection.id);
    if (!d) return <div className="map-detail" />;
    return (
      <div className="map-detail">
        <div className="map-detail-head">
          <div>
            <div className="section-label">District</div>
            <h3 className="district-name">
              {d.name} <span className={`badge tcond-${conditionSlug(d.label)}`}>{d.label}</span>
            </h3>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClear}>
            Clear
          </button>
        </div>
        <ConditionBar value={d.health} label={d.label} />
        {d.maturity > 0 && (
          <p className="tier" style={{ marginTop: '0.4rem' }}>
            maturity {d.maturity.toFixed(1)}
            {d.features.length > 0 && ` · ${d.features.map((f) => f.name).join(', ')}`}
          </p>
        )}
        {d.boroughs.map((b) => (
          <BoroughDetail key={b.id} borough={b} habits={habits} />
        ))}
        {d.landmarks.map((lm) => (
          <LandmarkDetail key={lm.id} lm={lm} habits={habits} />
        ))}
      </div>
    );
  }

  const borough = vm.districts.flatMap((d) => d.boroughs).find((b) => b.id === selection.id);
  if (!borough) return <div className="map-detail" />;
  return (
    <div className="map-detail">
      <div className="map-detail-head">
        <div>
          <div className="section-label">Borough</div>
          <h3 className="district-name">
            {borough.name} <span className={`badge tcond-${conditionSlug(borough.label)}`}>{borough.label}</span>
          </h3>
        </div>
        <button type="button" className="btn btn-sm" onClick={onClear}>
          Clear
        </button>
      </div>
      <ConditionBar value={borough.health} label={borough.label} />
      <HabitList habits={habits} kind="borough" id={borough.id} />
      {borough.landmarks.map((lm) => (
        <LandmarkDetail key={lm.id} lm={lm} habits={habits} />
      ))}
    </div>
  );
}
