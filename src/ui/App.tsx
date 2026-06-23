import { useEffect, useRef, useState } from 'react';
import type { CityState } from '../engine/types.ts';
import type { Profile } from '../engine/types.ts';
import {
  addHabit,
  updateHabit,
  addLandmark,
  renameLandmark,
  removeLandmark,
  addDistrict,
  renameDistrict,
  addBorough,
  renameBorough,
  applyCheckIn,
  applyMissedDay,
  cityDay,
  requestHabitRemoval,
  cancelHabitRemoval,
  confirmHabitRemoval,
  setProfile,
  addMilestone,
  removeMilestone,
} from '../engine/engine.ts';
import { buildCityViewModel } from '../engine/viewModel.ts';
import { buildLifeline } from '../engine/lifeline.ts';
import { todayISO } from '../engine/dates.ts';
import { createSeededCity } from '../engine/seed.ts';
import { LIFE_ERAS } from '../data/eras.ts';
import {
  saveCity,
  exportCity,
  importCity,
  loadResolvedCity,
  getLastCheckIn,
  recordCheckIn,
  resetResolution,
} from '../persistence/storage.ts';
import { CityView } from './CityView.tsx';
import { CheckIn } from './CheckIn.tsx';
import type { NewHabitFields } from './HabitCatalog.tsx';
import { LifePage } from './LifePage.tsx';
import { CityMap } from './CityMap.tsx';
import { ProfilePage } from './ProfilePage.tsx';
import { DevPanel } from './DevPanel.tsx';
import type { AdvanceMode } from './DevPanel.tsx';

type Page = 'city' | 'map' | 'life' | 'profile';

export function App() {
  const [city, setCity] = useState<CityState | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('city');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setCity(loadResolvedCity(todayISO()));
    setLastCheckIn(getLastCheckIn());
  }, []);

  function update(next: CityState) {
    setCity(next);
    saveCity(next);
  }

  function handleCheckIn(completedHabitIds: string[], loggedBadHabitIds: string[]) {
    if (!city) return;
    const today = todayISO();
    const next = applyCheckIn(city, { completedHabitIds, loggedBadHabitIds, dateISO: today });
    recordCheckIn(today);
    setLastCheckIn(today);
    update(next);
  }

  function handleCreateHabit(fields: NewHabitFields) {
    if (!city) return;
    update(
      addHabit(city, {
        id: crypto.randomUUID(),
        name: fields.name,
        kind: fields.kind,
        weight: fields.weight,
        target: fields.target,
        createdAtISO: todayISO(),
      }),
    );
  }

  function handleUpdateHabit(id: string, fields: { name?: string; weight?: number }) {
    if (city) update(updateHabit(city, id, fields));
  }

  function handleCreateLandmark(
    districtId: string,
    boroughId: string | null,
    name: string,
    attachHabitIds: string[],
  ) {
    if (!city) return;
    update(addLandmark(city, { districtId, boroughId, name, attachHabitIds }).state);
  }

  function handleRenameLandmark(id: string, name: string) {
    if (city) update(renameLandmark(city, id, name));
  }
  function handleRemoveLandmark(id: string) {
    if (city) update(removeLandmark(city, id));
  }

  function handleAddDistrict(name: string, description: string) {
    if (city) update(addDistrict(city, { name, description }).state);
  }
  function handleRenameDistrict(id: string, fields: { name?: string; description?: string }) {
    if (city) update(renameDistrict(city, id, fields));
  }
  function handleAddBorough(districtId: string, name: string) {
    if (city) update(addBorough(city, { districtId, name }).state);
  }
  function handleRenameBorough(id: string, name: string) {
    if (city) update(renameBorough(city, id, name));
  }

  function handleSetProfile(profile: Profile) {
    if (city) update(setProfile(city, profile, todayISO()));
  }

  function handleAddMilestone(label: string, dateISO: string) {
    if (city) update(addMilestone(city, { id: crypto.randomUUID(), label, dateISO }));
  }
  function handleRemoveMilestone(id: string) {
    if (city) update(removeMilestone(city, id));
  }

  function handleRequestRemoval(id: string) {
    if (city) update(requestHabitRemoval(city, id, todayISO()));
  }
  function handleCancelRemoval(id: string) {
    if (city) update(cancelHabitRemoval(city, id));
  }
  function handleConfirmRemoval(id: string) {
    if (city) update(confirmHabitRemoval(city, id, todayISO()));
  }

  // --- TEMPORARY: time-travel debug controls (remove before final release) ---
  function handleAdvance(times: number, mode: AdvanceMode) {
    if (!city) return;
    const goodIds = city.habits.filter((h) => h.kind === 'good').map((h) => h.id);
    const badIds = city.habits.filter((h) => h.kind === 'bad').map((h) => h.id);
    let s = city;
    for (let i = 0; i < times; i++) {
      if (mode === 'good') s = applyCheckIn(s, { completedHabitIds: goodIds, loggedBadHabitIds: [] });
      else if (mode === 'bad') s = applyCheckIn(s, { completedHabitIds: [], loggedBadHabitIds: badIds });
      else s = applyMissedDay(s);
    }
    update(s);
  }
  function handleReset() {
    const s = createSeededCity();
    resetResolution(todayISO());
    setLastCheckIn(null);
    update(s);
  }
  // --- END TEMPORARY ---

  function handleExport() {
    if (!city) return;
    const blob = new Blob([exportCity(city)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'polis-city.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      update(importCity(await file.text()));
    } catch {
      alert('That file is not a valid Polis city.');
    }
  }

  if (!city) {
    return <div className="container muted">Loading your city…</div>;
  }

  const vm = buildCityViewModel(city);
  const lifeline = buildLifeline(city.profile, todayISO(), LIFE_ERAS);
  const era = LIFE_ERAS.find((e) => e.id === lifeline.currentEraId);
  const canCheckIn = lastCheckIn !== todayISO();
  const named = city.profile.name.trim() !== '';
  const day = cityDay(city.profile, todayISO());

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>Polis</h1>
          <p className="subtitle">
            {named ? `${city.profile.name}'s city` : 'Your city, your self'} ·{' '}
            {named ? `day ${day}` : 'day 0 — name your city on the Profile tab to start the clock'}
          </p>
        </div>
        <div className="toolbar">
          <div className="tabs">
            <button className={`tab ${page === 'city' ? 'tab-on' : ''}`} onClick={() => setPage('city')}>
              City
            </button>
            <button className={`tab ${page === 'map' ? 'tab-on' : ''}`} onClick={() => setPage('map')}>
              Map
            </button>
            <button className={`tab ${page === 'life' ? 'tab-on' : ''}`} onClick={() => setPage('life')}>
              Life
            </button>
            <button className={`tab ${page === 'profile' ? 'tab-on' : ''}`} onClick={() => setPage('profile')}>
              Profile
            </button>
          </div>
          <button onClick={handleExport} className="btn">
            Export
          </button>
          <label className="btn">
            Import
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImport(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </header>

      {era && (
        <div className="era-banner" style={{ borderLeftColor: era.color }}>
          <span className="era-name">{era.name}</span>
          <span className="era-meta">
            {era.stage} · age {lifeline.age} · week {(lifeline.weeksLived + 1).toLocaleString()} of{' '}
            {lifeline.totalWeeks.toLocaleString()}
          </span>
        </div>
      )}

      {page === 'city' && (
        <>
          <CheckIn habits={city.habits} canCheckIn={canCheckIn} onComplete={handleCheckIn} />
          <CityView vm={vm} />
          <DevPanel onAdvance={handleAdvance} onReset={handleReset} />
        </>
      )}
      {page === 'map' && <CityMap vm={vm} />}
      {page === 'life' && (
        <LifePage vm={lifeline} profile={city.profile} eras={LIFE_ERAS} milestones={city.milestones} log={city.log} />
      )}
      {page === 'profile' && (
        <ProfilePage
          city={city}
          today={todayISO()}
          onSetProfile={handleSetProfile}
          onCreateHabit={handleCreateHabit}
          onUpdateHabit={handleUpdateHabit}
          onRequestRemoval={handleRequestRemoval}
          onCancelRemoval={handleCancelRemoval}
          onConfirmRemoval={handleConfirmRemoval}
          onCreateLandmark={handleCreateLandmark}
          onRenameLandmark={handleRenameLandmark}
          onRemoveLandmark={handleRemoveLandmark}
          onAddDistrict={handleAddDistrict}
          onRenameDistrict={handleRenameDistrict}
          onAddBorough={handleAddBorough}
          onRenameBorough={handleRenameBorough}
          onAddMilestone={handleAddMilestone}
          onRemoveMilestone={handleRemoveMilestone}
        />
      )}
    </div>
  );
}
