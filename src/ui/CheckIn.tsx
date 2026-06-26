import { useState } from 'react';
import type { Habit } from '../engine/types.ts';

interface Props {
  habits: Habit[];
  canCheckIn: boolean;
  canLogYesterday: boolean;
  onComplete: (completedHabitIds: string[], loggedBadHabitIds: string[]) => void;
  onCompleteYesterday: (completedHabitIds: string[], loggedBadHabitIds: string[]) => void;
}

export function CheckIn({ habits, canCheckIn, canLogYesterday, onComplete, onCompleteYesterday }: Props) {
  const goodHabits = habits.filter((h) => h.kind === 'good');
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
          <div className="col-label">Good habits</div>
          {goodHabits.map((h) => (
            <label key={h.id} className="habit">
              <input
                type="checkbox"
                disabled={!canCheckIn}
                checked={done.has(h.id)}
                onChange={() => toggle(done, setDone, h.id)}
              />
              {h.name}
            </label>
          ))}
          {goodHabits.length === 0 && <p className="abandoned">none yet</p>}
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
