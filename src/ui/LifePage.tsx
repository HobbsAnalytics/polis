import { useMemo } from 'react';
import type { Milestone, Profile } from '../engine/types.ts';
import type { LifelineVM } from '../engine/lifeline.ts';
import { weekSundayISO } from '../engine/lifeline.ts';
import { weekIndex } from '../engine/dates.ts';
import { useTooltip } from './useTooltip.tsx';
import { formatDate } from './format.ts';
import type { EraDef } from '../data/eras.ts';

interface Props {
  vm: LifelineVM;
  profile: Profile;
  eras: EraDef[];
  milestones: Milestone[];
}

export function LifePage({ vm, profile, eras, milestones }: Props) {
  const { handlers, tooltip } = useTooltip('.life-box', 240);

  const eraById = (id: string) => eras.find((e) => e.id === id);
  const currentEra = eraById(vm.currentEraId);
  const pctLeft = Math.round((vm.weeksLeft / vm.totalWeeks) * 100);

  const isOnChart = (m: Milestone) => {
    const idx = weekIndex(profile.birthDateISO, m.dateISO);
    return idx >= 0 && idx < vm.totalWeeks;
  };

  // The grid is expensive (~3,900 cells) — memoize so cursor moves (which only
  // touch tooltip state) don't rebuild it. Each cell carries its info in
  // data-info; one delegated handler drives the custom tooltip.
  const grid = useMemo(() => {
    const byWeek = new Map<number, Milestone[]>();
    for (const m of milestones) {
      const idx = weekIndex(profile.birthDateISO, m.dateISO);
      if (idx >= 0 && idx < vm.totalWeeks) {
        byWeek.set(idx, [...(byWeek.get(idx) ?? []), m]);
      }
    }
    const boxInfo = (index: number, isBirthday: boolean, year: number): string => {
      let t = `Week of ${formatDate(weekSundayISO(profile.birthDateISO, index))}`;
      if (isBirthday) t += ` · Birthday (age ${year})`;
      const ms = byWeek.get(index);
      if (ms) t += ` · ${ms.map((m) => m.label).join(', ')}`;
      return t;
    };

    return (
      <div className="lifegrid" {...handlers}>
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
                    data-info={boxInfo(c.index, i === 0, row.yearIndex)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
    // eraById is a stable closure over `eras`; deps cover the real inputs.
  }, [vm, milestones, profile, eras]);

  return (
    <div>
      <div className="panel">
        <h2>Your life in weeks</h2>
        <p className="muted">
          Each box is one week (hover for its date). A row is a year (52 weeks); every 5th year is
          spaced for scanning. Lifespan assumed {profile.lifespanYears} years. Edit your birthday,
          lifespan, and milestones on the Profile tab.
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
      </div>

      {milestones.length > 0 && (
        <div className="panel">
          <h2>Important dates</h2>
          <div className="habit-list">
            {milestones.map((m) => (
              <div key={m.id} className="habit-row">
                <div>
                  <span className="milestone-dot" /> <span className="landmark-name">{m.label}</span>{' '}
                  <span className="tier">
                    {formatDate(m.dateISO)}
                    {!isOnChart(m) && ' · (off the chart)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="legend">
          {eras.map((e) => (
            <span key={e.id} className={`legend-item ${e.id === vm.currentEraId ? 'legend-current' : ''}`}>
              <span className="legend-swatch" style={{ background: e.color }} />
              {e.name} <span className="tier">({e.startAge}–{e.endAge})</span>
            </span>
          ))}
        </div>

        {grid}
      </div>

      {tooltip}
    </div>
  );
}
