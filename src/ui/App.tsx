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
import { LIFE_ERAS } from '../data/eras.ts';
import {
  saveCity,
  exportCity,
  importCity,
  loadResolvedCity,
  getLastCheckIn,
  recordCheckIn,
} from '../persistence/storage.ts';
import { hasSeenSplash, markSplashSeen } from '../persistence/splash.ts';
import type { SplashPage } from '../persistence/splash.ts';
import { CheckIn } from './CheckIn.tsx';
import { Modal } from './Modal.tsx';
import { SplashModal } from './SplashModal.tsx';
import { LifePage } from './LifePage.tsx';
import { CityMap } from './CityMap.tsx';
import { ProfilePage } from './ProfilePage.tsx';
import type { NewHabitFields } from './ProfilePage.tsx';
import { HistoryPage } from './HistoryPage.tsx';

type Page = 'map' | 'life' | 'history' | 'profile';

export function App() {
  const [city, setCity] = useState<CityState | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('map');
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [activeSplash, setActiveSplash] = useState<SplashPage | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setCity(loadResolvedCity(todayISO()));
    setLastCheckIn(getLastCheckIn());
    // The Map splash greets on first launch (Map is the default page).
    if (!hasSeenSplash('map')) setActiveSplash('map');
  }, []);

  // Navigate to a page, auto-opening its splash the first time it's visited ever.
  // Driven by the nav action (not an effect) so re-renders never reopen it.
  function goToPage(next: Page) {
    setPage(next);
    if (!hasSeenSplash(next)) setActiveSplash(next);
  }

  function closeSplash() {
    if (activeSplash) markSplashSeen(activeSplash);
    setActiveSplash(null);
  }

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

  function handleCreateLandmark(districtId: string, boroughId: string, name: string) {
    if (!city) return;
    update(addLandmark(city, { districtId, boroughId, name }).state);
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
          <div className="brand">
            <h1>Polis</h1>
            <span className="epigraph">the shape of how you&rsquo;ve been living</span>
          </div>
          <p className="subtitle">
            {named ? `${city.profile.name}'s city` : 'Your city, your self'} · day {day}
            {!named && ' · name your city on the Profile tab'}
          </p>
        </div>
        <div className="toolbar">
          <div className="tabs">
            <button className={`tab ${page === 'map' ? 'tab-on' : ''}`} onClick={() => goToPage('map')}>
              Map
            </button>
            <button className={`tab ${page === 'life' ? 'tab-on' : ''}`} onClick={() => goToPage('life')}>
              Life
            </button>
            <button className={`tab ${page === 'history' ? 'tab-on' : ''}`} onClick={() => goToPage('history')}>
              History
            </button>
            <button className={`tab ${page === 'profile' ? 'tab-on' : ''}`} onClick={() => goToPage('profile')}>
              Profile
            </button>
          </div>
          <button
            type="button"
            className="help-btn"
            aria-label="About this page"
            title="About this page"
            onClick={() => setActiveSplash(page)}
          >
            ?
          </button>
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

      {page === 'map' && (
        <>
          {era && (
            <div className="era-banner" style={{ borderLeftColor: era.color }}>
              <span className="era-name">{era.name}</span>
              <span className="era-meta">
                {era.stage} · age {lifeline.age} · week {(lifeline.weeksLived + 1).toLocaleString()} of{' '}
                {lifeline.totalWeeks.toLocaleString()}
              </span>
            </div>
          )}
          <CityMap
            vm={vm}
            habits={city.habits}
            canCheckIn={canCheckIn}
            onLogToday={() => setCheckInOpen(true)}
          />
        </>
      )}
      {page === 'life' && (
        <LifePage vm={lifeline} profile={city.profile} eras={LIFE_ERAS} milestones={city.milestones} log={city.log} />
      )}
      {page === 'history' && <HistoryPage city={city} />}
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

      {checkInOpen && (
        <Modal title="Daily check-in" onClose={() => setCheckInOpen(false)}>
          <CheckIn
            habits={city.habits}
            canCheckIn={canCheckIn}
            onComplete={(good, bad) => {
              handleCheckIn(good, bad);
              setCheckInOpen(false);
            }}
          />
        </Modal>
      )}

      {activeSplash && (
        <SplashModal
          page={activeSplash}
          onClose={closeSplash}
          onDontShowAgain={() => markSplashSeen(activeSplash)}
        />
      )}
    </div>
  );
}
