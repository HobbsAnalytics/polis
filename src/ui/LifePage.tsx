import type { Profile } from '../engine/types.ts';
import type { LifelineVM } from '../engine/lifeline.ts';
import type { EraDef } from '../data/eras.ts';

interface Props {
  vm: LifelineVM;
  profile: Profile;
  eras: EraDef[];
  onSetProfile: (profile: Profile) => void;
}

export function LifePage({ vm, profile, eras, onSetProfile }: Props) {
  const eraById = (id: string) => eras.find((e) => e.id === id);
  const currentEra = eraById(vm.currentEraId);
  const pctLeft = Math.round((vm.weeksLeft / vm.totalWeeks) * 100);

  return (
    <div>
      <div className="panel">
        <h2>Your life in weeks</h2>
        <p className="muted">
          Each box is one week. A row is a year (52 weeks); every 5th year is spaced for scanning.
          Lifespan assumed {profile.lifespanYears} years.
        </p>
        <p className="life-summary">
          <strong>{vm.weeksLived.toLocaleString()}</strong> weeks lived ·{' '}
          <strong>{vm.weeksLeft.toLocaleString()}</strong> weeks left ·{' '}
          <strong>{pctLeft}%</strong> of life remaining · age {vm.age}
          {currentEra && (
            <>
              {' '}· <span style={{ color: '#44403c' }}>{currentEra.name}</span>
            </>
          )}
        </p>

        <div className="form-grid">
          <label className="field">
            Birthday
            <input
              type="date"
              name="birthday"
              value={profile.birthDateISO}
              onChange={(e) => onSetProfile({ ...profile, birthDateISO: e.target.value })}
            />
          </label>
          <label className="field">
            Lifespan (years)
            <input
              type="number"
              name="lifespan"
              min={1}
              value={profile.lifespanYears}
              onChange={(e) =>
                onSetProfile({ ...profile, lifespanYears: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="legend">
          {eras.map((e) => (
            <span
              key={e.id}
              className={`legend-item ${e.id === vm.currentEraId ? 'legend-current' : ''}`}
            >
              <span className="legend-swatch" style={{ background: e.color }} />
              {e.name} <span className="tier">({e.startAge}–{e.endAge})</span>
            </span>
          ))}
        </div>

        <div className="lifegrid">
          {vm.years.map((row) => {
            const era = eraById(row.eraId);
            const blockGap = row.yearIndex % 5 === 4;
            return (
              <div
                key={row.yearIndex}
                className={`life-row ${blockGap ? 'life-row-gap' : ''}`}
                style={{ borderLeftColor: era?.color ?? 'transparent' }}
              >
                <div className="life-era-label">{row.eraStart ? era?.name : ''}</div>
                <div className="life-weeks">
                  {row.weeks.map((c) => (
                    <span key={c.index} className={`life-box life-${c.status}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
