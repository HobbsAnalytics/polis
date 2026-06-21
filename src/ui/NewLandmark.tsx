import { useState } from 'react';
import type { Borough, Habit } from '../engine/types.ts';

interface Props {
  districts: { id: string; name: string }[];
  boroughs: Borough[];
  habits: Habit[];
  onCreate: (districtId: string, boroughId: string | null, name: string, attachHabitIds: string[]) => void;
}

export function NewLandmark({ districts, boroughs, habits, onCreate }: Props) {
  const [districtId, setDistrictId] = useState(districts[0]?.id ?? '');
  const [boroughId, setBoroughId] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const districtBoroughs = boroughs.filter((b) => b.districtId === districtId);
  const goodHabits = habits.filter((h) => h.kind === 'good');
  const badHabits = habits.filter((h) => h.kind === 'bad');

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function submit() {
    const ids = [...selected];
    const anyGood = goodHabits.some((h) => selected.has(h.id));
    if (!name.trim()) return setError('Name the landmark.');
    if (!anyGood) return setError('Attach at least one good habit from the catalog.');
    setError('');
    onCreate(districtId, boroughId || null, name.trim(), ids);
    setName('');
    setSelected(new Set());
  }

  return (
    <div className="panel">
      <h2>Raise a landmark</h2>
      <p className="muted">Place it, then attach habits from the catalog (at least one good habit).</p>

      <div className="form-grid">
        <label className="field">
          District
          <select
            name="lmDistrict"
            value={districtId}
            onChange={(e) => {
              setDistrictId(e.target.value);
              setBoroughId('');
            }}
          >
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Borough (optional)
          <select name="lmBorough" value={boroughId} onChange={(e) => setBoroughId(e.target.value)}>
            <option value="">— directly in district —</option>
            {districtBoroughs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Landmark name
          <input name="lmName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sobriety Cathedral" />
        </label>
      </div>

      <div className="checkin-cols" style={{ marginTop: '0.75rem' }}>
        <div>
          <div className="col-label">Attach good habits</div>
          {goodHabits.map((h) => (
            <label key={h.id} className="habit">
              <input type="checkbox" checked={selected.has(h.id)} onChange={() => toggle(h.id)} />
              {h.name}
            </label>
          ))}
          {goodHabits.length === 0 && <p className="abandoned">create some in the catalog first</p>}
        </div>
        <div>
          <div className="col-label">Attach bad habits (optional)</div>
          {badHabits.map((h) => (
            <label key={h.id} className="habit">
              <input type="checkbox" checked={selected.has(h.id)} onChange={() => toggle(h.id)} />
              {h.name}
            </label>
          ))}
          {badHabits.length === 0 && <p className="abandoned">none yet</p>}
        </div>
      </div>

      {error && <p className="note-warn">{error}</p>}
      <button onClick={submit} className="btn-primary" style={{ marginTop: '0.75rem' }}>
        Create landmark
      </button>
    </div>
  );
}
