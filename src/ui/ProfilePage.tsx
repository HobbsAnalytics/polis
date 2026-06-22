import { useState } from 'react';
import type { CityState, Milestone, Profile } from '../engine/types.ts';
import { weekIndex } from '../engine/dates.ts';
import { formatDate } from './format.ts';
import { HabitCatalog } from './HabitCatalog.tsx';
import type { NewHabitFields } from './HabitCatalog.tsx';
import { NewLandmark } from './NewLandmark.tsx';

interface Props {
  city: CityState;
  today: string;
  onSetProfile: (profile: Profile) => void;
  onCreateHabit: (fields: NewHabitFields) => void;
  onUpdateHabit: (habitId: string, fields: { name?: string; weight?: number }) => void;
  onRequestRemoval: (id: string) => void;
  onCancelRemoval: (id: string) => void;
  onConfirmRemoval: (id: string) => void;
  onCreateLandmark: (districtId: string, boroughId: string | null, name: string, attachHabitIds: string[]) => void;
  onRenameLandmark: (id: string, name: string) => void;
  onRemoveLandmark: (id: string) => void;
  onAddDistrict: (name: string, description: string) => void;
  onRenameDistrict: (id: string, fields: { name?: string; description?: string }) => void;
  onAddBorough: (districtId: string, name: string) => void;
  onRenameBorough: (id: string, name: string) => void;
  onAddMilestone: (label: string, dateISO: string) => void;
  onRemoveMilestone: (id: string) => void;
}

// ---- Identity ----

function IdentitySection({ profile, onSetProfile }: { profile: Profile; onSetProfile: (p: Profile) => void }) {
  return (
    <div className="panel">
      <h2>Identity</h2>
      <p className="muted">Who this city belongs to, and the lifespan that frames the Life page.</p>
      <div className="form-grid">
        <label className="field">
          Your name
          <input
            name="userName"
            value={profile.name}
            placeholder="e.g. Joseph"
            onChange={(e) => onSetProfile({ ...profile, name: e.target.value })}
          />
        </label>
        <label className="field">
          Date of birth
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
            onChange={(e) => onSetProfile({ ...profile, lifespanYears: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
      </div>
    </div>
  );
}

// ---- Districts ----

function DistrictsSection({
  city,
  onAddDistrict,
  onRenameDistrict,
}: Pick<Props, 'city' | 'onAddDistrict' | 'onRenameDistrict'>) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (!name.trim()) return setError('Name the district.');
    setError('');
    onAddDistrict(name.trim(), description.trim());
    setName('');
    setDescription('');
  }

  return (
    <div className="panel">
      <h2>Districts</h2>
      <p className="muted">Your wellbeing domains — each is a neighborhood on the map.</p>

      <div className="habit-list">
        {city.districts.map((d) => (
          <div key={d.id} className="district-edit-row">
            <input
              className="inline-edit"
              value={d.name}
              aria-label="District name"
              onChange={(e) => onRenameDistrict(d.id, { name: e.target.value })}
            />
            <input
              className="inline-edit inline-edit-desc"
              value={d.description}
              placeholder="short description"
              aria-label="District description"
              onChange={(e) => onRenameDistrict(d.id, { description: e.target.value })}
            />
          </div>
        ))}
        {city.districts.length === 0 && <p className="abandoned">no districts yet</p>}
      </div>

      <div className="form-grid" style={{ marginTop: '0.75rem' }}>
        <label className="field">
          New district
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Health" />
        </label>
        <label className="field">
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" />
        </label>
      </div>
      {error && <p className="note-warn">{error}</p>}
      <button onClick={submit} className="btn-primary" style={{ marginTop: '0.5rem' }}>
        Add district
      </button>
    </div>
  );
}

// ---- Boroughs ----

function BoroughsSection({
  city,
  onAddBorough,
  onRenameBorough,
}: Pick<Props, 'city' | 'onAddBorough' | 'onRenameBorough'>) {
  const [districtId, setDistrictId] = useState(city.districts[0]?.id ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const districtName = (id: string) => city.districts.find((d) => d.id === id)?.name ?? '—';

  function submit() {
    if (!districtId) return setError('Create a district first.');
    if (!name.trim()) return setError('Name the borough.');
    setError('');
    onAddBorough(districtId, name.trim());
    setName('');
  }

  return (
    <div className="panel">
      <h2>Boroughs</h2>
      <p className="muted">Optional sub-areas within a district.</p>

      <div className="habit-list">
        {city.boroughs.map((b) => (
          <div key={b.id} className="district-edit-row">
            <input
              className="inline-edit"
              value={b.name}
              aria-label="Borough name"
              onChange={(e) => onRenameBorough(b.id, e.target.value)}
            />
            <span className="tier">in {districtName(b.districtId)}</span>
          </div>
        ))}
        {city.boroughs.length === 0 && <p className="abandoned">no boroughs yet</p>}
      </div>

      <div className="form-grid" style={{ marginTop: '0.75rem' }}>
        <label className="field">
          District
          <select value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            {city.districts.length === 0 ? (
              <option value="">(create a district first)</option>
            ) : (
              city.districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="field">
          New borough
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sleep" />
        </label>
      </div>
      {error && <p className="note-warn">{error}</p>}
      <button onClick={submit} className="btn-primary" style={{ marginTop: '0.5rem' }}>
        Add borough
      </button>
    </div>
  );
}

// ---- Landmarks (manage existing: rename / remove) ----

function LandmarksManager({
  city,
  onRenameLandmark,
  onRemoveLandmark,
}: Pick<Props, 'city' | 'onRenameLandmark' | 'onRemoveLandmark'>) {
  const place = (districtId: string, boroughId: string | null) => {
    const d = city.districts.find((x) => x.id === districtId)?.name ?? '—';
    const b = boroughId ? city.boroughs.find((x) => x.id === boroughId)?.name : null;
    return b ? `${d} › ${b}` : d;
  };

  if (city.landmarks.length === 0) return null;

  return (
    <div className="panel">
      <h2>Manage landmarks</h2>
      <p className="muted">Rename a landmark or remove it (its habits move up to the parent area).</p>
      <div className="habit-list">
        {city.landmarks.map((lm) => (
          <div key={lm.id} className="habit-row">
            <div className="habit-edit">
              <input
                className="inline-edit"
                value={lm.name}
                aria-label="Landmark name"
                onChange={(e) => onRenameLandmark(lm.id, e.target.value)}
              />
              <span className="tier">{place(lm.districtId, lm.boroughId)}</span>
            </div>
            <button className="btn" onClick={() => onRemoveLandmark(lm.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Milestones ----

function MilestonesSection({
  city,
  onAddMilestone,
  onRemoveMilestone,
}: Pick<Props, 'city' | 'onAddMilestone' | 'onRemoveMilestone'>) {
  const [label, setLabel] = useState('');
  const [dateISO, setDateISO] = useState('');
  const [error, setError] = useState('');

  const totalWeeks = city.profile.lifespanYears * 52;
  const isOnChart = (m: Milestone) => {
    const idx = weekIndex(city.profile.birthDateISO, m.dateISO);
    return idx >= 0 && idx < totalWeeks;
  };

  function submit() {
    if (!label.trim()) return setError('Name the date.');
    if (!dateISO) return setError('Pick a date.');
    setError('');
    onAddMilestone(label.trim(), dateISO);
    setLabel('');
    setDateISO('');
  }

  return (
    <div className="panel">
      <h2>Important dates</h2>
      <p className="muted">Mark milestones — a wedding, a child's birthday, a new job, a move.</p>
      <div className="form-grid">
        <label className="field">
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Wedding" />
        </label>
        <label className="field">
          Date
          <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
        </label>
      </div>
      {error && <p className="note-warn">{error}</p>}
      <button onClick={submit} className="btn-primary" style={{ marginTop: '0.5rem' }}>
        Add date
      </button>

      {city.milestones.length > 0 && (
        <div className="habit-list" style={{ marginTop: '0.75rem' }}>
          {city.milestones.map((m) => (
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
  );
}

export function ProfilePage(props: Props) {
  const { city, today } = props;
  return (
    <div>
      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Profile</h2>
        <p className="muted">
          The one place to define your world — identity, districts, boroughs, habits, landmarks, and
          important dates. Every other page just reflects what you set here.
        </p>
      </div>

      <IdentitySection profile={city.profile} onSetProfile={props.onSetProfile} />
      <DistrictsSection city={city} onAddDistrict={props.onAddDistrict} onRenameDistrict={props.onRenameDistrict} />
      <BoroughsSection city={city} onAddBorough={props.onAddBorough} onRenameBorough={props.onRenameBorough} />
      <HabitCatalog
        habits={city.habits}
        districts={city.districts}
        boroughs={city.boroughs}
        landmarks={city.landmarks}
        today={today}
        cooldownDays={city.settings.removalCooldownDays}
        onCreateHabit={props.onCreateHabit}
        onUpdateHabit={props.onUpdateHabit}
        onRequestRemoval={props.onRequestRemoval}
        onCancelRemoval={props.onCancelRemoval}
        onConfirmRemoval={props.onConfirmRemoval}
      />
      <NewLandmark
        districts={city.districts.map((d) => ({ id: d.id, name: d.name }))}
        boroughs={city.boroughs}
        habits={city.habits}
        onCreate={props.onCreateLandmark}
      />
      <LandmarksManager city={city} onRenameLandmark={props.onRenameLandmark} onRemoveLandmark={props.onRemoveLandmark} />
      <MilestonesSection city={city} onAddMilestone={props.onAddMilestone} onRemoveMilestone={props.onRemoveMilestone} />
    </div>
  );
}
