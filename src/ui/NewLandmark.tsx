import { useState } from 'react';

interface Props {
  districts: { id: string; name: string }[];
  onCreate: (
    districtId: string,
    name: string,
    goodHabitNames: string[],
    badHabitNames: string[],
  ) => void;
}

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function NewLandmark({ districts, onCreate }: Props) {
  const [districtId, setDistrictId] = useState(districts[0]?.id ?? '');
  const [name, setName] = useState('');
  const [good, setGood] = useState('');
  const [bad, setBad] = useState('');
  const [error, setError] = useState('');

  function submit() {
    const goodNames = parseLines(good);
    const badNames = parseLines(bad);
    if (!name.trim()) return setError('Name the landmark.');
    if (!districtId) return setError('Pick a district.');
    if (goodNames.length === 0) return setError('A landmark needs at least one good habit.');
    setError('');
    onCreate(districtId, name.trim(), goodNames, badNames);
    setName('');
    setGood('');
    setBad('');
  }

  return (
    <div className="panel">
      <h2>Raise a landmark</h2>
      <p className="muted">Every monument needs its habits — one per line.</p>

      <div className="form-grid">
        <label className="field">
          District
          <select name="district" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Landmark name
          <input
            name="landmarkName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sobriety Cathedral"
          />
        </label>
        <label className="field">
          Good habits (one per line)
          <textarea name="goodHabits" value={good} onChange={(e) => setGood(e.target.value)} rows={3} />
        </label>
        <label className="field">
          Bad habits (one per line, optional)
          <textarea name="badHabits" value={bad} onChange={(e) => setBad(e.target.value)} rows={3} />
        </label>
      </div>

      {error && <p className="note-warn">{error}</p>}

      <button onClick={submit} className="btn-primary" style={{ marginTop: '1rem' }}>
        Create landmark
      </button>
    </div>
  );
}
