import { useState } from 'react';
import type { SelectHTMLAttributes } from 'react';
import type { Borough, CityState, District, Habit, HabitKind, HabitTargetKind, Landmark, Milestone, Profile } from '../engine/types.ts';
import { weekIndex, dayDiffISO } from '../engine/dates.ts';
import { formatDate } from './format.ts';

export interface NewHabitFields {
  name: string;
  kind: HabitKind;
  weight: number;
  target: { kind: HabitTargetKind; id: string };
}

interface Props {
  city: CityState;
  today: string;
  onSetProfile: (profile: Profile) => void;
  onCreateHabit: (fields: NewHabitFields) => void;
  onUpdateHabit: (habitId: string, fields: { name?: string; weight?: number }) => void;
  onRequestRemoval: (id: string) => void;
  onCancelRemoval: (id: string) => void;
  onConfirmRemoval: (id: string) => void;
  onCreateLandmark: (districtId: string, boroughId: string, name: string) => void;
  onRenameLandmark: (id: string, name: string) => void;
  onRemoveLandmark: (id: string) => void;
  onAddDistrict: (name: string, description: string) => void;
  onRenameDistrict: (id: string, fields: { name?: string; description?: string }) => void;
  onAddBorough: (districtId: string, name: string) => void;
  onRenameBorough: (id: string, name: string) => void;
  onAddMilestone: (label: string, dateISO: string) => void;
  onRemoveMilestone: (id: string) => void;
}

/** Shared callbacks + context threaded down the city tree. */
interface TreeCtx {
  city: CityState;
  today: string;
  cooldownDays: number;
  open: Set<string>;
  onToggle: (id: string) => void;
  onCreateHabit: Props['onCreateHabit'];
  onUpdateHabit: Props['onUpdateHabit'];
  onRequestRemoval: Props['onRequestRemoval'];
  onCancelRemoval: Props['onCancelRemoval'];
  onConfirmRemoval: Props['onConfirmRemoval'];
  onCreateLandmark: Props['onCreateLandmark'];
  onRenameLandmark: Props['onRenameLandmark'];
  onRemoveLandmark: Props['onRemoveLandmark'];
  onRenameDistrict: Props['onRenameDistrict'];
  onAddBorough: Props['onAddBorough'];
  onRenameBorough: Props['onRenameBorough'];
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

// ---- Importance dropdown (shared) ----

/** How much a habit matters → its numeric weight in the simulation. */
const IMPORTANCE: { weight: number; label: string }[] = [
  { weight: 1, label: 'Somewhat important' },
  { weight: 2, label: 'Important' },
  { weight: 3, label: 'Very important' },
];

function ImportanceSelect({
  value,
  onChange,
  ...rest
}: {
  value: number;
  onChange: (weight: number) => void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'>) {
  // Clamp legacy weights >3 onto "Very important" for display, without rewriting them.
  return (
    <select value={Math.min(3, Math.max(1, value))} onChange={(e) => onChange(Number(e.target.value))} {...rest}>
      {IMPORTANCE.map((o) => (
        <option key={o.weight} value={o.weight}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---- Habit row (rename / reweight / remove + cooldown), reused under borough & landmark ----

function HabitRow({ habit, t }: { habit: Habit; t: TreeCtx }) {
  const pending = habit.pendingRemovalSinceISO;
  const daysLeft = pending ? t.cooldownDays - dayDiffISO(pending, t.today) : 0;
  return (
    <div className="habit-row">
      <div className="habit-edit">
        <input
          className="inline-edit"
          value={habit.name}
          aria-label="Habit name"
          onChange={(e) => t.onUpdateHabit(habit.id, { name: e.target.value })}
        />
        <span className={`badge ${habit.kind === 'bad' ? 'tcond-onfire' : 'tcond-pristine'}`}>{habit.kind}</span>
        <ImportanceSelect
          className="weight-edit"
          value={habit.weight}
          aria-label="Habit importance"
          onChange={(weight) => t.onUpdateHabit(habit.id, { weight })}
        />
      </div>
      {pending ? (
        <div className="removal">
          <p className="note-warn" style={{ margin: 0 }}>
            Marked for removal.{' '}
            {daysLeft > 0
              ? `Come back in ${daysLeft} day${daysLeft === 1 ? '' : 's'} to confirm.`
              : 'You can confirm now.'}
          </p>
          <div className="dev-buttons">
            <button className="btn" disabled={daysLeft > 0} onClick={() => t.onConfirmRemoval(habit.id)}>
              Confirm removal
            </button>
            <button className="btn" onClick={() => t.onCancelRemoval(habit.id)}>
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button className="btn" onClick={() => t.onRequestRemoval(habit.id)}>
          Remove
        </button>
      )}
    </div>
  );
}

// ---- Add-habit inline form (borough or landmark target) ----

function AddHabitForm({
  targetKind,
  targetId,
  onCreateHabit,
  onClose,
}: {
  targetKind: HabitTargetKind;
  targetId: string;
  onCreateHabit: Props['onCreateHabit'];
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<HabitKind>('good');
  const [weight, setWeight] = useState(1);
  const [error, setError] = useState('');

  function submit() {
    if (!name.trim()) return setError('Name the habit.');
    onCreateHabit({ name: name.trim(), kind, weight, target: { kind: targetKind, id: targetId } });
    onClose();
  }

  return (
    <div className="add-form">
      <div className="form-grid">
        <label className="field">
          Habit name
          <input
            name="habitName"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Didn't drink"
          />
        </label>
        <label className="field">
          Kind
          <select name="habitKind" value={kind} onChange={(e) => setKind(e.target.value as HabitKind)}>
            <option value="good">good</option>
            <option value="bad">bad</option>
          </select>
        </label>
        <label className="field">
          Importance
          <ImportanceSelect value={weight} onChange={setWeight} name="habitWeight" />
        </label>
      </div>
      {error && <p className="note-warn">{error}</p>}
      <div className="tree-actions">
        <button onClick={submit} className="btn btn-sm btn-primary">
          Add habit
        </button>
        <button onClick={onClose} className="btn btn-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---- Landmark node ----

function LandmarkNode({ landmark, t }: { landmark: Landmark; t: TreeCtx }) {
  const [adding, setAdding] = useState(false);
  const habits = t.city.habits.filter((h) => h.target.kind === 'landmark' && h.target.id === landmark.id);
  return (
    <div className="tree-landmark">
      <div className="tree-row">
        <span className="tree-leaf" aria-hidden="true">
          📍
        </span>
        <input
          className="inline-edit"
          value={landmark.name}
          aria-label="Landmark name"
          onChange={(e) => t.onRenameLandmark(landmark.id, e.target.value)}
        />
        <button className="btn btn-sm" onClick={() => setAdding((a) => !a)}>
          + Add Habit
        </button>
        <button className="btn btn-sm" onClick={() => t.onRemoveLandmark(landmark.id)}>
          Remove
        </button>
      </div>
      {adding && (
        <AddHabitForm targetKind="landmark" targetId={landmark.id} onCreateHabit={t.onCreateHabit} onClose={() => setAdding(false)} />
      )}
      {habits.length > 0 && (
        <div className="habit-list">
          {habits.map((h) => (
            <HabitRow key={h.id} habit={h} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Borough node ----

function BoroughNode({ borough, t }: { borough: Borough; t: TreeCtx }) {
  const [addingHabit, setAddingHabit] = useState(false);
  const [addingLm, setAddingLm] = useState(false);
  const [lmName, setLmName] = useState('');
  const [lmError, setLmError] = useState('');

  const isOpen = t.open.has(borough.id);
  const habits = t.city.habits.filter((h) => h.target.kind === 'borough' && h.target.id === borough.id);
  const landmarks = t.city.landmarks.filter((l) => l.boroughId === borough.id);

  function addLandmark() {
    if (!lmName.trim()) return setLmError('Name the landmark.');
    t.onCreateLandmark(borough.districtId, borough.id, lmName.trim());
    setLmName('');
    setLmError('');
    setAddingLm(false);
  }

  return (
    <div className="tree-borough">
      <div className="tree-row">
        <button className="tree-toggle" aria-label={isOpen ? 'Collapse borough' : 'Expand borough'} onClick={() => t.onToggle(borough.id)}>
          {isOpen ? '▾' : '▸'}
        </button>
        <input
          className="inline-edit"
          value={borough.name}
          aria-label="Borough name"
          onChange={(e) => t.onRenameBorough(borough.id, e.target.value)}
        />
        <span className="tier">
          {landmarks.length} landmark{landmarks.length === 1 ? '' : 's'} · {habits.length} habit{habits.length === 1 ? '' : 's'}
        </span>
      </div>

      {isOpen && (
        <div className="tree-children">
          <div className="tree-actions">
            <button className="btn btn-sm" onClick={() => setAddingHabit((a) => !a)}>
              + Add Habit
            </button>
            <button className="btn btn-sm" onClick={() => setAddingLm((a) => !a)}>
              + Add Landmark
            </button>
          </div>

          {addingHabit && (
            <AddHabitForm targetKind="borough" targetId={borough.id} onCreateHabit={t.onCreateHabit} onClose={() => setAddingHabit(false)} />
          )}
          {addingLm && (
            <div className="add-form">
              <div className="add-inline">
                <input
                  className="inline-edit"
                  autoFocus
                  value={lmName}
                  placeholder="e.g. Sobriety Cathedral"
                  aria-label="New landmark name"
                  onChange={(e) => setLmName(e.target.value)}
                />
                <button className="btn btn-sm btn-primary" onClick={addLandmark}>
                  Add landmark
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setAddingLm(false);
                    setLmName('');
                    setLmError('');
                  }}
                >
                  Cancel
                </button>
              </div>
              {lmError && <p className="note-warn">{lmError}</p>}
            </div>
          )}

          {habits.length > 0 && (
            <div className="habit-list">
              {habits.map((h) => (
                <HabitRow key={h.id} habit={h} t={t} />
              ))}
            </div>
          )}

          {landmarks.map((l) => (
            <LandmarkNode key={l.id} landmark={l} t={t} />
          ))}
          {habits.length === 0 && landmarks.length === 0 && <p className="abandoned">empty — add a habit or a landmark</p>}
        </div>
      )}
    </div>
  );
}

// ---- District node ----

function DistrictNode({ district, t }: { district: District; t: TreeCtx }) {
  const [addingBorough, setAddingBorough] = useState(false);
  const [boroughName, setBoroughName] = useState('');
  const [error, setError] = useState('');

  const isOpen = t.open.has(district.id);
  const boroughs = t.city.boroughs.filter((b) => b.districtId === district.id);

  function addBorough() {
    if (!boroughName.trim()) return setError('Name the borough.');
    t.onAddBorough(district.id, boroughName.trim());
    setBoroughName('');
    setError('');
    setAddingBorough(false);
  }

  return (
    <div className="tree-district">
      <div className="tree-row">
        <button className="tree-toggle" aria-label={isOpen ? 'Collapse district' : 'Expand district'} onClick={() => t.onToggle(district.id)}>
          {isOpen ? '▾' : '▸'}
        </button>
        <input
          className="inline-edit"
          value={district.name}
          aria-label="District name"
          onChange={(e) => t.onRenameDistrict(district.id, { name: e.target.value })}
        />
        <input
          className="inline-edit inline-edit-desc"
          value={district.description}
          placeholder="short description"
          aria-label="District description"
          onChange={(e) => t.onRenameDistrict(district.id, { description: e.target.value })}
        />
        <span className="tier">
          {boroughs.length} borough{boroughs.length === 1 ? '' : 's'}
        </span>
      </div>

      {isOpen && (
        <div className="tree-children">
          {boroughs.map((b) => (
            <BoroughNode key={b.id} borough={b} t={t} />
          ))}
          <div className="tree-actions">
            {addingBorough ? (
              <div className="add-form" style={{ width: '100%' }}>
                <div className="add-inline">
                  <input
                    className="inline-edit"
                    autoFocus
                    value={boroughName}
                    placeholder="e.g. Sleep"
                    aria-label="New borough name"
                    onChange={(e) => setBoroughName(e.target.value)}
                  />
                  <button className="btn btn-sm btn-primary" onClick={addBorough}>
                    Add borough
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setAddingBorough(false);
                      setBoroughName('');
                      setError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {error && <p className="note-warn">{error}</p>}
              </div>
            ) : (
              <button className="btn btn-sm" onClick={() => setAddingBorough(true)}>
                + Add Borough
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- The city tree ----

function CityTree({ t, onAddDistrict }: { t: TreeCtx; onAddDistrict: Props['onAddDistrict'] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  function addDistrict() {
    if (!name.trim()) return setError('Name the district.');
    onAddDistrict(name.trim(), description.trim());
    setName('');
    setDescription('');
    setError('');
    setAdding(false);
  }

  return (
    <div className="panel">
      <h2>Your city</h2>
      <p className="muted">
        Expand a district to manage its boroughs, landmarks, and habits. Every district keeps at least one borough; new
        districts start with a "General" borough. Habits attach to a borough or a landmark.
      </p>

      {t.city.districts.map((d) => (
        <DistrictNode key={d.id} district={d} t={t} />
      ))}
      {t.city.districts.length === 0 && <p className="abandoned">no districts yet</p>}

      <div className="tree-actions" style={{ marginTop: '0.75rem' }}>
        {adding ? (
          <div className="add-form" style={{ width: '100%' }}>
            <div className="form-grid">
              <label className="field">
                New district
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Health" />
              </label>
              <label className="field">
                Description
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="optional" />
              </label>
            </div>
            {error && <p className="note-warn">{error}</p>}
            <div className="tree-actions">
              <button className="btn btn-sm btn-primary" onClick={addDistrict}>
                Add district
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setAdding(false);
                  setName('');
                  setDescription('');
                  setError('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            + Add District
          </button>
        )}
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
  const [open, setOpen] = useState<Set<string>>(() => new Set(city.districts.map((d) => d.id)));
  const onToggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const t: TreeCtx = {
    city,
    today,
    cooldownDays: city.settings.removalCooldownDays,
    open,
    onToggle,
    onCreateHabit: props.onCreateHabit,
    onUpdateHabit: props.onUpdateHabit,
    onRequestRemoval: props.onRequestRemoval,
    onCancelRemoval: props.onCancelRemoval,
    onConfirmRemoval: props.onConfirmRemoval,
    onCreateLandmark: props.onCreateLandmark,
    onRenameLandmark: props.onRenameLandmark,
    onRemoveLandmark: props.onRemoveLandmark,
    onRenameDistrict: props.onRenameDistrict,
    onAddBorough: props.onAddBorough,
    onRenameBorough: props.onRenameBorough,
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h2>Profile</h2>
        <p className="muted">
          The one place to define your world — identity, the district › borough › landmark tree with its habits, and
          important dates. Every other page just reflects what you set here.
        </p>
      </div>

      <IdentitySection profile={city.profile} onSetProfile={props.onSetProfile} />
      <CityTree t={t} onAddDistrict={props.onAddDistrict} />
      <MilestonesSection city={city} onAddMilestone={props.onAddMilestone} onRemoveMilestone={props.onRemoveMilestone} />
    </div>
  );
}
