import type { ReactNode } from 'react';
import type { CityState } from '../engine/types.ts';
import { groupGoodHabits } from './checkinGroups.ts';
import { habitsForDistrict, districtsWithHabits, districtBadgeCount } from './habitDistrict.ts';

interface Props {
  city: CityState;
  selectedDay: 'today' | 'yesterday';
  onSelectDay: (day: 'today' | 'yesterday') => void;
  canEditYesterday: boolean;
  selectedDistrictId: string | null;
  onSelectDistrict: (id: string) => void;
  isLogged: (habitId: string) => boolean;
  onToggle: (habitId: string, kind: 'good' | 'bad', on: boolean) => void;
  todayISO: string;
}

export function CheckIn({ city, selectedDay, onSelectDay, canEditYesterday, selectedDistrictId, onSelectDistrict, isLogged, onToggle, todayISO }: Props) {
  const districts = districtsWithHabits(city);
  const habits = selectedDistrictId ? habitsForDistrict(city, selectedDistrictId) : [];
  const groups = groupGoodHabits(habits, todayISO);
  const slips = habits.filter((h) => h.kind === 'bad');

  const row = (id: string, kind: 'good' | 'bad', label: ReactNode) => (
    <label key={id} className="habit">
      <input type="checkbox" checked={isLogged(id)} onChange={(e) => onToggle(id, kind, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="checkin">
      <div className="day-toggle">
        <button className={selectedDay === 'today' ? 'on' : ''} onClick={() => onSelectDay('today')}>Today</button>
        <button className={selectedDay === 'yesterday' ? 'on' : ''} disabled={!canEditYesterday} onClick={() => onSelectDay('yesterday')}>Yesterday</button>
      </div>

      <div className="district-tabs">
        {districts.map((d) => {
          const n = districtBadgeCount(city, d.id, todayISO);
          return (
            <button key={d.id} className={d.id === selectedDistrictId ? 'tab on' : 'tab'} onClick={() => onSelectDistrict(d.id)}>
              {d.name}{n > 0 && <span className="badge">{n}</span>}
            </button>
          );
        })}
      </div>

      {groups.overdue.length > 0 && (<><div className="col-label">Overdue</div>{groups.overdue.map(({ habit, status }) => row(habit.id, 'good', <>{habit.name}<span className="muted"> · overdue {status.daysOverdue}d</span></>))}</>)}
      {groups.dueToday.length > 0 && (<><div className="col-label">Due today</div>{groups.dueToday.map(({ habit }) => row(habit.id, 'good', <>{habit.name}<span className="muted"> · due today</span></>))}</>)}
      {groups.maintained.length > 0 && (<><div className="col-label">Maintained</div>{groups.maintained.map(({ habit, status }) => row(habit.id, 'good', <>{habit.name}<span className="muted"> ✓ maintained · due in {status.dueInDays}d</span></>))}</>)}
      {slips.length > 0 && (<><div className="col-label">Slips (mark if you did it)</div>{slips.map((h) => row(h.id, 'bad', h.name))}</>)}
      {habits.length === 0 && <p className="abandoned">none in this district yet</p>}
    </div>
  );
}
