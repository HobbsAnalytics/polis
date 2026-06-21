import { useEffect, useRef, useState } from 'react';
import type { CityState } from '../engine/types.ts';
import { addHabit, addLandmark, applyCheckIn, applyMissedDay } from '../engine/engine.ts';
import { buildCityViewModel } from '../engine/viewModel.ts';
import { createSeededCity } from '../engine/seed.ts';
import { saveCity, loadCity, exportCity, importCity, catchUpMissedDays } from '../persistence/storage.ts';
import { CityView } from './CityView.tsx';
import { CheckIn } from './CheckIn.tsx';
import { NewLandmark } from './NewLandmark.tsx';
import { DevPanel } from './DevPanel.tsx';
import type { AdvanceMode } from './DevPanel.tsx';

const LAST_RESOLVED = 'polis.lastResolved';
const LAST_CHECKIN = 'polis.lastCheckIn';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function dayDiff(aISO: string, bISO: string): number {
  return Math.round((Date.parse(bISO) - Date.parse(aISO)) / 86_400_000);
}
function addDays(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);
}

export function App() {
  const [city, setCity] = useState<CityState | null>(null);
  const [lastCheckIn, setLastCheckIn] = useState<string | null>(null);
  const initialized = useRef(false);

  // One-time init: load (or seed), then apply missed days since last resolved date.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let s = loadCity() ?? createSeededCity();
    const today = todayStr();
    const lastResolved = localStorage.getItem(LAST_RESOLVED);

    if (lastResolved == null) {
      localStorage.setItem(LAST_RESOLVED, today);
    } else {
      const missed = Math.max(0, dayDiff(lastResolved, today) - 1);
      if (missed > 0) {
        s = catchUpMissedDays(s, missed);
        localStorage.setItem(LAST_RESOLVED, addDays(today, -1));
        saveCity(s);
      }
    }
    setCity(s);
    setLastCheckIn(localStorage.getItem(LAST_CHECKIN));
  }, []);

  function update(next: CityState) {
    setCity(next);
    saveCity(next);
  }

  function handleCheckIn(completedHabitIds: string[], loggedBadHabitIds: string[]) {
    if (!city) return;
    const next = applyCheckIn(city, { completedHabitIds, loggedBadHabitIds });
    const today = todayStr();
    localStorage.setItem(LAST_RESOLVED, today);
    localStorage.setItem(LAST_CHECKIN, today);
    setLastCheckIn(today);
    update(next);
  }

  function handleCreateLandmark(
    districtId: string,
    name: string,
    goodHabitNames: string[],
    badHabitNames: string[],
  ) {
    if (!city) return;
    const r = addLandmark(city, { districtId, name });
    let s = r.state;
    for (const n of goodHabitNames) {
      s = addHabit(s, { id: crypto.randomUUID(), name: n, kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
    }
    for (const n of badHabitNames) {
      s = addHabit(s, { id: crypto.randomUUID(), name: n, kind: 'bad', target: { kind: 'landmark', landmarkId: r.landmarkId } });
    }
    update(s);
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
    localStorage.removeItem(LAST_CHECKIN);
    localStorage.setItem(LAST_RESOLVED, todayStr());
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
      const text = await file.text();
      update(importCity(text));
    } catch {
      alert('That file is not a valid Polis city.');
    }
  }

  if (!city) {
    return <div className="container muted">Loading your city…</div>;
  }

  const vm = buildCityViewModel(city);
  const canCheckIn = lastCheckIn !== todayStr();

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>Polis</h1>
          <p className="subtitle">Your city, your self · day {vm.day}</p>
        </div>
        <div className="toolbar">
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

      <CheckIn habits={city.habits} canCheckIn={canCheckIn} onComplete={handleCheckIn} />
      <CityView vm={vm} />
      <div style={{ height: '1.5rem' }} />
      <NewLandmark
        districts={city.districts.map((d) => ({ id: d.id, name: d.name }))}
        onCreate={handleCreateLandmark}
      />
      <DevPanel onAdvance={handleAdvance} onReset={handleReset} />
    </div>
  );
}
