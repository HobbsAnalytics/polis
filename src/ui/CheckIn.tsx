import { useState } from 'react';
import type { Habit } from '../engine/types.ts';
import { groupGoodHabits } from './checkinGroups.ts';

interface Props {
  habits: Habit[];
  canCheckIn: boolean;
  canLogYesterday: boolean;
  todayISO: string;
  onComplete: (completedHabitIds: string[], loggedBadHabitIds: string[]) => void;
  onCompleteYesterday: (completedHabitIds: string[], loggedBadHabitIds: string[]) => void;
}

export function CheckIn({ habits, canCheckIn, canLogYesterday, todayISO, onComplete, onCompleteYesterday }: Props) {
  const badHabits = habits.filter((h) => h.kind === 'bad');
  const [done, setDone] = useState<Set<string>>(new Set());
  const [slipped, setSlipped] = useState<Set<string>>(new Set());

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function submit() {
    onComplete([...done], [...slipped]);
    setDone(new Set());
    setSlipped(new Set());
  }

  return (
    <div className="checkin">
      {!canCheckIn && <p className="note-ok">Already checked in today. See you tomorrow.</p>}

      <div className="checkin-cols">
        <div>
          {(() => {
            const groups = groupGoodHabits(habits, todayISO);
            const allEmpty = groups.overdue.length === 0 && groups.dueToday.length === 0 && groups.maintained.length === 0;
            if (allEmpty) return <p className="abandoned">none yet</p>;
            return (
              <>
                {groups.overdue.length > 0 && (
                  <>
                    <div className="col-label">Overdue</div>
                    {groups.overdue.map(({ habit, status }) => (
                      <label key={habit.id} className="habit">
                        <input
                          type="checkbox"
                          disabled={!canCheckIn}
                          checked={done.has(habit.id)}
                          onChange={() => toggle(done, setDone, habit.id)}
                        />
                        {habit.name}<span className="muted"> · overdue {status.daysOverdue}d</span>
                      </label>
                    ))}
                  </>
                )}
                {groups.dueToday.length > 0 && (
                  <>
                    <div className="col-label">Due today</div>
                    {groups.dueToday.map(({ habit }) => (
                      <label key={habit.id} className="habit">
                        <input
                          type="checkbox"
                          disabled={!canCheckIn}
                          checked={done.has(habit.id)}
                          onChange={() => toggle(done, setDone, habit.id)}
                        />
                        {habit.name}<span className="muted"> · due today</span>
                      </label>
                    ))}
                  </>
                )}
                {groups.maintained.length > 0 && (
                  <>
                    <div className="col-label">Maintained</div>
                    {groups.maintained.map(({ habit, status }) => (
                      <label key={habit.id} className="habit">
                        <input
                          type="checkbox"
                          disabled={!canCheckIn}
                          checked={done.has(habit.id)}
                          onChange={() => toggle(done, setDone, habit.id)}
                        />
                        {habit.name}<span className="muted">✓ maintained · due in {status.dueInDays}d</span>
                      </label>
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </div>

        <div>
          <div className="col-label">Bad habits (mark if you did it)</div>
          {badHabits.map((h) => (
            <label key={h.id} className="habit">
              <input
                type="checkbox"
                disabled={!canCheckIn}
                checked={slipped.has(h.id)}
                onChange={() => toggle(slipped, setSlipped, h.id)}
              />
              {h.name}
            </label>
          ))}
          {badHabits.length === 0 && <p className="abandoned">none yet</p>}
        </div>
      </div>

      <button onClick={submit} disabled={!canCheckIn} className="btn-primary" style={{ marginTop: '1.25rem' }}>
        Complete check-in
      </button>

      {canLogYesterday && (
        <>
          <button
            onClick={() => onCompleteYesterday([...done], [...slipped])}
            className="btn"
            style={{ marginTop: '0.5rem' }}
          >
            Log these for yesterday instead
          </button>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Forgot yesterday? Log it before today — once you log today, yesterday closes.
          </p>
        </>
      )}
    </div>
  );
}
