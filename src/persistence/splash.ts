// Per-device onboarding-splash state. Deliberately a standalone localStorage key,
// separate from the city save and excluded from Export/Import — which splashes a
// user has dismissed is a property of the device, not of the city. Mirrors the
// discrete-key pattern used for last-resolved / last-checkin in storage.ts.

export type SplashPage = 'map' | 'life' | 'history' | 'profile';

const SEEN_KEY = 'polis.splash.seen';

/** Parse the seen-set defensively: missing/garbage/non-array → empty set. */
function readSeen(): Set<SplashPage> {
  const raw = localStorage.getItem(SEEN_KEY);
  if (raw == null) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((p): p is SplashPage => typeof p === 'string') as SplashPage[]);
  } catch {
    return new Set();
  }
}

/** Has this page's splash already been seen (dismissed) on this device? */
export function hasSeenSplash(page: SplashPage): boolean {
  return readSeen().has(page);
}

/** Record this page's splash as seen. Idempotent; recovers from a corrupt key. */
export function markSplashSeen(page: SplashPage): void {
  const seen = readSeen();
  seen.add(page);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}
