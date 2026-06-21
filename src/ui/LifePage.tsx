import { useState } from 'react';
import type { Milestone, Profile } from '../engine/types.ts';
import type { LifelineVM } from '../engine/lifeline.ts';
import { weekSundayISO } from '../engine/lifeline.ts';
import type { EraDef } from '../data/eras.ts';

interface Props {
  vm: LifelineVM;
  profile: Profile;
  eras: EraDef[];
  milestones: Milestone[];
  onSetProfile: (profile: Profile) => void;
  onAddMilestone: (label: string, dateISO: string) => void;
  onRemoveMilestone: (id: string) => void;
}

const MS_PER_WEEK = 7 * 86_400_000;

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function milestoneWeekIndex(birthDateISO: string, dateISO: string): number {
  return Math.floor((Date.parse(dateISO) - Date.parse(birthDateISO)) / MS_PER_WEEK);
}

export function LifePage({
  vm,
  profile,
  eras,
  milestones,
  onSetProfile,
  onAddMilestone,
  onRemoveMilestone,
}: Props) {
  const [label, setLabel] = useState('');
  const [dateISO, setDateISO] = useState('');
  const [error, setError] = useState('');

  const eraById = (id: string) => eras.find((e) => e.id === id);
  const currentEra = eraById(vm.currentEraId);
  const pctLeft = Math.round((vm.weeksLeft / vm.totalWeeks) * 100);

  // week index → milestones falling in that week (only those on the chart)
  const byWeek = new Map<number, Milestone[]>();
  for (const m of milestones) {
    const idx = milestoneWeekIndex(profile.birthDateISO, m.dateISO);
    if (idx >= 0 && idx < vm.totalWeeks) {
      byWeek.set(idx, [...(byWeek.get(idx) ?? []), m]);
    }
  }
  const isOnChart = (m: Milestone) => {
    const idx = milestoneWeekIndex(profile.birthDateISO, m.dateISO);
    return idx >= 0 && idx < vm.totalWeeks;
  };

  function submitMilestone() {
    if (!label.trim()) return setError('Name the date.');
    if (!dateISO) return setError('Pick a date.');
    setError('');
    onAddMilestone(label.trim(), dateISO);
    setLabel('');
    setDateISO('');
  }

  function boxTitle(index: number, isBirthday: boolean, year: number): string {
    let t = `Week of ${formatDate(weekSundayISO(profile.birthDateISO, index))}`;
    if (isBirthday) t += ` · Birthday (age ${year})`;
    const ms = byWeek.get(index);
    if (ms) t += ` · ${ms.map((m) => m.label).join(', ')}`;
    return t;
  }

  return (
    <div>
      <div className="panel">
        <h2>Your life in weeks</h2>
        <p className="muted">
          Each box is one week (hover for its date). A row is a year (52 weeks); every 5th year is
          spaced for scanning. Lifespan assumed {profile.lifespanYears} years.
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
        <h2>Important dates</h2>
        <p className="muted">Mark milestones — a wedding, a child's birthday, a new job, a move.</p>
        <div className="form-grid">
          <label className="field">
            Label
            <input
              name="milestoneLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Wedding"
            />
          </label>
          <label className="field">
            Date
            <input type="date" name="milestoneDate" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
          </label>
        </div>
        {error && <p className="note-warn">{error}</p>}
        <button onClick={submitMilestone} className="btn-primary" style={{ marginTop: '0.5rem' }}>
          Add date
        </button>

        {milestones.length > 0 && (
          <div className="habit-list" style={{ marginTop: '0.75rem' }}>
            {milestones.map((m) => (
              <div key={m.id} className="habit-row">
                <div>
                  <span className="milestone-dot" /> <span className="landmark-name">{m.label}</span>{' '}
                  <span className="tier">
                    {formatDate(m.dateISO)}
                    {!isOnChart(m) && ' · (off the chart)'}
                  </span>
                </div>
                <button className="btn" onClick={() => onRemoveMilestone(m.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="legend">
          {eras.map((e) => (
            <span key={e.id} className={`legend-item ${e.id === vm.currentEraId ? 'legend-current' : ''}`}>
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
                  {row.weeks.map((c, i) => (
                    <span
                      key={c.index}
                      className={`life-box life-${c.status} ${i === 0 ? 'life-birthday' : ''} ${byWeek.has(c.index) ? 'life-milestone' : ''}`}
                      title={boxTitle(c.index, i === 0, row.yearIndex)}
                    />
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
