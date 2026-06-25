import { useState } from 'react';
import type { CityState } from '../engine/types.ts';
import { cityAtSnapshot } from '../engine/history.ts';
import { buildCityViewModel } from '../engine/viewModel.ts';
import { weekTrend } from '../engine/lifeline.ts';
import { formatDate } from './format.ts';
import { CityMap } from './CityMap.tsx';

const TREND_LABEL: Record<string, string> = {
  up: 'thrived',
  'slight-up': 'improved',
  flat: 'held steady',
  'slight-down': 'slipped',
  down: 'declined',
  none: 'no change',
};

export function HistoryPage({ city }: { city: CityState }) {
  const log = city.log;
  // Default to the most recent recorded day; remounts on tab switch reset this.
  const [idx, setIdx] = useState(Math.max(0, log.length - 1));

  if (log.length === 0) {
    return (
      <div className="panel">
        <h2>History</h2>
        <p className="muted">
          No history yet. Each day you check in (or a day passes) is recorded here — then you can
          step back through your city's story.
        </p>
      </div>
    );
  }

  const at = Math.min(idx, log.length - 1);
  const entry = log[at];
  const vm = buildCityViewModel(cityAtSnapshot(city, entry.snapshot));
  const trend = weekTrend(entry.netHealthChange);
  const net = entry.netHealthChange;

  return (
    <div>
      <div className="panel">
        <div className="dev-head">
          <h2>History</h2>
          <span className="tier">
            {at + 1} of {log.length} recorded days
          </span>
        </div>
        <p className="muted">
          Step back through your city. This view is read-only — a snapshot of how things stood that
          day.
        </p>

        <div className="history-controls">
          <button className="btn" onClick={() => setIdx(0)} disabled={at === 0}>
            ⏮ First
          </button>
          <button className="btn" onClick={() => setIdx(at - 1)} disabled={at === 0}>
            ◀ Back
          </button>
          <input
            type="range"
            min={0}
            max={log.length - 1}
            value={at}
            aria-label="History day"
            onChange={(e) => setIdx(Number(e.target.value))}
          />
          <button className="btn" onClick={() => setIdx(at + 1)} disabled={at === log.length - 1}>
            Next ▶
          </button>
          <button className="btn" onClick={() => setIdx(log.length - 1)} disabled={at === log.length - 1}>
            Latest ⏭
          </button>
        </div>

        <p className="history-summary">
          <strong>Day {entry.day}</strong>
          {entry.dateISO && <> · {formatDate(entry.dateISO)}</>} ·{' '}
          {entry.checkedIn ? `checked in (${entry.completedHabitIds.length} good`
            : 'no check-in'}
          {entry.checkedIn && entry.loggedBadHabitIds.length > 0 && `, ${entry.loggedBadHabitIds.length} bad`}
          {entry.checkedIn && ')'} ·{' '}
          <span className={`badge tcond-${trend === 'up' || trend === 'slight-up' ? 'pristine' : trend === 'flat' || trend === 'none' ? 'worn' : 'onfire'}`}>
            {TREND_LABEL[trend]} {net >= 0 ? '+' : ''}
            {net.toFixed(2)}
          </span>
        </p>
      </div>

      <CityMap vm={vm} habits={city.habits} />
    </div>
  );
}
