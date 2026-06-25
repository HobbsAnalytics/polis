import { it, expect, beforeEach } from '../testkit.ts';
import { hasSeenSplash, markSplashSeen } from './splash.ts';

const KEY = 'polis.splash.seen';

beforeEach(() => {
  localStorage.clear();
});

it('hasSeenSplash returns false for every page when nothing is stored', () => {
  expect(hasSeenSplash('map')).toBe(false);
  expect(hasSeenSplash('life')).toBe(false);
  expect(hasSeenSplash('history')).toBe(false);
  expect(hasSeenSplash('profile')).toBe(false);
});

it('markSplashSeen then hasSeenSplash returns true for that page only', () => {
  markSplashSeen('map');
  expect(hasSeenSplash('map')).toBe(true);
  expect(hasSeenSplash('life')).toBe(false);
});

it('marking is idempotent — no duplicate ids accumulate', () => {
  markSplashSeen('profile');
  markSplashSeen('profile');
  const stored = JSON.parse(localStorage.getItem(KEY)!) as string[];
  expect(stored).toEqual(['profile']);
});

it('marking several pages accumulates them all', () => {
  markSplashSeen('map');
  markSplashSeen('history');
  expect(hasSeenSplash('map')).toBe(true);
  expect(hasSeenSplash('history')).toBe(true);
  expect(hasSeenSplash('life')).toBe(false);
  expect(hasSeenSplash('profile')).toBe(false);
});

it('persists under the standalone polis.splash.seen key as a JSON array', () => {
  markSplashSeen('life');
  expect(localStorage.getItem(KEY)).toBe('["life"]');
});

it('reads defensively: garbage in the key is treated as nothing seen', () => {
  localStorage.setItem(KEY, 'not json{');
  expect(hasSeenSplash('map')).toBe(false);
});

it('reads defensively: a non-array JSON value is treated as nothing seen', () => {
  localStorage.setItem(KEY, '{"map":true}');
  expect(hasSeenSplash('map')).toBe(false);
});

it('marking recovers from a corrupt key (starts a fresh set)', () => {
  localStorage.setItem(KEY, 'garbage');
  markSplashSeen('map');
  expect(hasSeenSplash('map')).toBe(true);
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['map']);
});
