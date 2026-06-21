import { useState } from 'react';
import type { Borough, District, Habit, Landmark, NodeKind } from '../engine/types.ts';
import { dayDiffISO } from '../engine/engine.ts';

export interface NewHabitFields {
  name: string;
  kind: Habit['kind'];
  weight: number;
  target: { kind: NodeKind; id: string };
}

interface Props {
  habits: Habit[];
  districts: District[];
  boroughs: Borough[];
  landmarks: Landmark[];
  today: string;
  cooldownDays: number;
  onCreateHabit: (fields: NewHabitFields) => void;
  onRequestRemoval: (habitId: string) => void;
  onCancelRemoval: (habitId: string) => void;
  onConfirmRemoval: (habitId: string) => void;
}

export function HabitCatalog({
  habits,
  districts,
  boroughs,
  landmarks,
  today,
  cooldownDays,
  onCreateHabit,
  onRequestRemoval,
  onCancelRemoval,
  onConfirmRemoval,
}: Props) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Habit['kind']>('good');
  const [weight, setWeight] = useState(1);
  const [targetKind, setTargetKind] = useState<NodeKind>('district');
  const [targetId, setTargetId] = useState(districts[0]?.id ?? '');
  const [error, setError] = useState('');

  const targetOptions =
    targetKind === 'district'
      ? districts.map((d) => ({ id: d.id, label: d.name }))
      : targetKind === 'borough'
        ? boroughs.map((b) => ({ id: b.id, label: b.name }))
        : landmarks.map((l) => ({ id: l.id, label: l.name }));

  function resolveDistrictName(h: Habit): string {
    if (h.target.kind === 'district') return districts.find((d) => d.id === h.target.id)?.name ?? '—';
    if (h.target.kind === 'borough') {
      const b = boroughs.find((x) => x.id === h.target.id);
      const d = districts.find((x) => x.id === b?.districtId);
      return b ? `${d?.name ?? '—'} › ${b.name}` : '—';
    }
    const lm = landmarks.find((x) => x.id === h.target.id);
    const d = districts.find((x) => x.id === lm?.districtId);
    return lm ? `${d?.name ?? '—'} › ${lm.name}` : '—';
  }

  function changeTargetKind(k: NodeKind) {
    setTargetKind(k);
    const first =
      k === 'district' ? districts[0]?.id : k === 'borough' ? boroughs[0]?.id : landmarks[0]?.id;
    setTargetId(first ?? '');
  }

  function submit() {
    if (!name.trim()) return setError('Name the habit.');
    if (!targetId) return setError('Pick something for it to attach to.');
    setError('');
    onCreateHabit({ name: name.trim(), kind, weight, target: { kind: targetKind, id: targetId } });
    setName('');
    setWeight(1);
  }

  return (
    <div className="panel">
      <h2>Habit catalog</h2>
      <p className="muted">Every habit lives here, attached to a district, borough, or landmark.</p>

      {/* Create */}
      <div className="form-grid">
        <label className="field">
          Habit name
          <input name="habitName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Didn't drink" />
        </label>
        <label className="field">
          Kind
          <select name="habitKind" value={kind} onChange={(e) => setKind(e.target.value as Habit['kind'])}>
            <option value="good">good</option>
            <option value="bad">bad</option>
          </select>
        </label>
        <label className="field">
          Weight
          <input
            name="habitWeight"
            type="number"
            min={1}
            step={1}
            value={weight}
            onChange={(e) => setWeight(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className="field">
          Attach to
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem' }}>
            <select name="targetKind" value={targetKind} onChange={(e) => changeTargetKind(e.target.value as NodeKind)}>
              <option value="district">district</option>
              <option value="borough">borough</option>
              <option value="landmark">landmark</option>
            </select>
            <select name="targetId" value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ flex: 1 }}>
              {targetOptions.length === 0 ? (
                <option value="">(none yet)</option>
              ) : (
                targetOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))
              )}
            </select>
          </div>
        </label>
      </div>
      {error && <p className="note-warn">{error}</p>}
      <button onClick={submit} className="btn-primary" style={{ marginTop: '0.75rem' }}>
        Add habit
      </button>

      {/* List */}
      <div className="section-label">All habits ({habits.length})</div>
      <div className="habit-list">
        {habits.map((h) => {
          const pending = h.pendingRemovalSinceISO;
          const daysLeft = pending ? cooldownDays - dayDiffISO(pending, today) : 0;
          return (
            <div key={h.id} className="habit-row">
              <div>
                <span className="landmark-name">{h.name}</span>{' '}
                <span className={`badge ${h.kind === 'bad' ? 'tcond-onfire' : 'tcond-pristine'}`}>{h.kind}</span>
                <span className="tier"> ·×{h.weight} · {resolveDistrictName(h)}</span>
              </div>
              {pending ? (
                <div className="removal">
                  <p className="note-warn" style={{ margin: 0 }}>
                    Past Joseph thought this was worth tracking; Present Joseph disagrees.{' '}
                    {daysLeft > 0
                      ? `Come back in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — if Future Joseph agrees, off it goes.`
                      : 'Future Joseph can confirm now.'}
                  </p>
                  <div className="dev-buttons">
                    <button className="btn" disabled={daysLeft > 0} onClick={() => onConfirmRemoval(h.id)}>
                      Confirm removal
                    </button>
                    <button className="btn" onClick={() => onCancelRemoval(h.id)}>
                      Keep it
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn" onClick={() => onRequestRemoval(h.id)}>
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
