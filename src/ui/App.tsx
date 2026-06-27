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
import { replayDrafts } from '../engine/replay.ts';
import { LIFE_ERAS } from '../data/eras.ts';
import {
  saveCity,
  exportCity,
  importCity,
  loadResolvedCity,
  openDraftWindow,
} from '../persistence/storage.ts';
import {
  loadDrafts,
  saveDrafts,
  setHabitLogged,
  isHabitLoggedForDay,
} from '../persistence/drafts.ts';
import type { DraftStore } from '../persistence/drafts.ts';
import { districtsWithHabits, districtBadgeCount } from './habitDistrict.ts';
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
  const today = todayISO();
  const [committed, setCommitted] = useState<CityState | null>(null);
  const [drafts, setDrafts] = useState<DraftStore>({});
  const [selectedDay, setSelectedDay] = useState<'today' | 'yesterday'>('today');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('map');
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [activeSplash, setActiveSplash] = useState<SplashPage | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setCommitted(loadResolvedCity(today));
    setDrafts(loadDrafts());
    // The Map splash greets on first launch (Map is the default page).
    if (!hasSeenSplash('map')) setActiveSplash('map');
  }, [today]);

  useEffect(() => {
    const resync = () => {
      const t = todayISO();
      // Re-resolve if a new calendar day arrived since we last rendered.
      setCommitted(loadResolvedCity(t));
      setDrafts(loadDrafts());
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') resync();
    };
    window.addEventListener('focus', resync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', resync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Displayed city = committed base + replayed open-window drafts. Never saved.
  const draftWindow = openDraftWindow(today); // ordered [yesterday?, today]
  const city = committed ? replayDrafts(committed, draftWindow) : null;

  const earliest = draftWindow[0]?.dateISO; // yesterday in steady state
  const canEditYesterday = draftWindow.length > 1;
  const selectedDateISO = selectedDay === 'yesterday' && canEditYesterday ? earliest! : today;

  function handleToggleHabit(habitId: string, kind: 'good' | 'bad', on: boolean) {
    const nextDrafts = setHabitLogged(loadDrafts(), selectedDateISO, habitId, kind, on);
    saveDrafts(nextDrafts);
    setDrafts(nextDrafts);
  }

  function isLogged(habitId: string): boolean {
    if (!committed) return false;
    const habit = committed.habits.find((h) => h.id === habitId);
    return habit ? isHabitLoggedForDay(drafts, selectedDateISO, habit) : false;
  }

  // Default the district once the city is known: attention-first.
  useEffect(() => {
    if (!city || selectedDistrictId) return;
    const withHabits = districtsWithHabits(city);
    const attention = withHabits.find((d) => districtBadgeCount(city, d.id, today) > 0);
    setSelectedDistrictId((attention ?? withHabits[0])?.id ?? null);
  }, [city, selectedDistrictId, today]);

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

  // Structural mutations operate on the committed base and persist it as polis.city.
  // The displayed city (committed + replayed drafts) is never saved.
  function commitMutation(nextCommitted: CityState) {
    setCommitted(nextCommitted);
    saveCity(nextCommitted); // polis.city = committed base
  }

  function handleCreateHabit(fields: NewHabitFields) {
    if (!committed) return;
    commitMutation(
      addHabit(committed, {
        id: crypto.randomUUID(),
        name: fields.name,
        kind: fields.kind,
        weight: fields.weight,
        target: fields.target,
        createdAtISO: todayISO(),
        ...(fields.kind === 'good' ? { cadence: fields.cadence ?? 'daily', lastCompletedISO: todayISO() } : {}),
      }),
    );
  }

  function handleUpdateHabit(id: string, fields: { name?: string; weight?: number }) {
    if (committed) commitMutation(updateHabit(committed, id, fields));
  }

  function handleCreateLandmark(districtId: string, boroughId: string, name: string) {
    if (!committed) return;
    commitMutation(addLandmark(committed, { districtId, boroughId, name }).state);
  }

  function handleRenameLandmark(id: string, name: string) {
    if (committed) commitMutation(renameLandmark(committed, id, name));
  }
  function handleRemoveLandmark(id: string) {
    if (committed) commitMutation(removeLandmark(committed, id));
  }

  function handleAddDistrict(name: string, description: string) {
    if (committed) commitMutation(addDistrict(committed, { name, description }).state);
  }
  function handleRenameDistrict(id: string, fields: { name?: string; description?: string }) {
    if (committed) commitMutation(renameDistrict(committed, id, fields));
  }
  function handleAddBorough(districtId: string, name: string) {
    if (committed) commitMutation(addBorough(committed, { districtId, name }).state);
  }
  function handleRenameBorough(id: string, name: string) {
    if (committed) commitMutation(renameBorough(committed, id, name));
  }

  function handleSetProfile(profile: Profile) {
    if (committed) commitMutation(setProfile(committed, profile, todayISO()));
  }

  function handleAddMilestone(label: string, dateISO: string) {
    if (committed) commitMutation(addMilestone(committed, { id: crypto.randomUUID(), label, dateISO }));
  }
  function handleRemoveMilestone(id: string) {
    if (committed) commitMutation(removeMilestone(committed, id));
  }

  function handleRequestRemoval(id: string) {
    if (committed) commitMutation(requestHabitRemoval(committed, id, todayISO()));
  }
  function handleCancelRemoval(id: string) {
    if (committed) commitMutation(cancelHabitRemoval(committed, id));
  }
  function handleConfirmRemoval(id: string) {
    if (committed) commitMutation(confirmHabitRemoval(committed, id, todayISO()));
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
      commitMutation(importCity(await file.text()));
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
            city={city}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            canEditYesterday={canEditYesterday}
            selectedDistrictId={selectedDistrictId}
            onSelectDistrict={setSelectedDistrictId}
            isLogged={isLogged}
            onToggle={handleToggleHabit}
            todayISO={selectedDateISO}
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
