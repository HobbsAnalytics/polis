import { it, expect } from '../testkit.ts';
import {
  createCity,
  applyCheckIn,
  applyMissedDay,
  addLandmark,
  addHabit,
  requestHabitRemoval,
  cancelHabitRemoval,
  confirmHabitRemoval,
  addMilestone,
  removeMilestone,
} from './engine.ts';
import { districtHealth } from './rollup.ts';
import type { District, Habit, TargetRef } from './types.ts';

const dist = (id: string, healthDirect = 0.5): District => ({
  id,
  name: id,
  description: '',
  healthDirect,
  maturity: 0,
  features: [],
});
const hab = (id: string, kind: Habit['kind'], target: TargetRef, weight = 1): Habit => ({
  id,
  name: id,
  kind,
  weight,
  target,
  createdAtISO: '2026-01-01',
});

it('good habit raises landmark condition; missing it lowers slightly', () => {
  let s = createCity({ districts: [dist('d1')] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = addHabit(r.state, hab('h1', 'good', { kind: 'landmark', id: r.landmarkId }));
  const before = s.landmarks[0].condition;
  const up = applyCheckIn(s, { completedHabitIds: ['h1'], loggedBadHabitIds: [] });
  expect(up.landmarks[0].condition).toBeGreaterThan(before);
  const down = applyCheckIn(s, { completedHabitIds: [], loggedBadHabitIds: [] });
  expect(down.landmarks[0].condition).toBeLessThan(before);
});

it('habit weight scales its effect', () => {
  let s = createCity({ districts: [dist('d1', 0.5), dist('d2', 0.5)] });
  s = addHabit(s, hab('h1', 'good', { kind: 'district', id: 'd1' }, 1));
  s = addHabit(s, hab('h2', 'good', { kind: 'district', id: 'd2' }, 3));
  const up = applyCheckIn(s, { completedHabitIds: ['h1', 'h2'], loggedBadHabitIds: [] });
  const gain1 = up.districts[0].healthDirect - 0.5;
  const gain2 = up.districts[1].healthDirect - 0.5;
  expect(gain2).toBeGreaterThan(gain1);
});

it('neglect gradient: bad habit > missed habit > missed checkin', () => {
  let s = createCity({ districts: [dist('d1')] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = r.state;
  s = addHabit(s, hab('g', 'good', { kind: 'landmark', id: r.landmarkId }));
  s = addHabit(s, hab('b', 'bad', { kind: 'landmark', id: r.landmarkId }));
  const start = 0.8;
  s.landmarks[0].condition = start;
  const badHit = start - applyCheckIn(s, { completedHabitIds: ['g'], loggedBadHabitIds: ['b'] }).landmarks[0].condition;
  const missHabit = start - applyCheckIn(s, { completedHabitIds: [], loggedBadHabitIds: [] }).landmarks[0].condition;
  const missCheckin = start - applyMissedDay(s).landmarks[0].condition;
  expect(badHit).toBeGreaterThan(missHabit);
  expect(missHabit).toBeGreaterThan(missCheckin);
});

it('one missed day is small, three weeks is large (weeks not days)', () => {
  let s = createCity({ districts: [dist('d1')] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = addHabit(r.state, hab('g', 'good', { kind: 'landmark', id: r.landmarkId }));
  s.landmarks[0].condition = 1;
  const oneDay = 1 - applyMissedDay(s).landmarks[0].condition;
  let t = s;
  for (let i = 0; i < 21; i++) t = applyMissedDay(t);
  expect(oneDay).toBeLessThan(0.05);
  expect(1 - t.landmarks[0].condition).toBeGreaterThan(0.3);
});

it('condition clamps to [0,1] and state is not mutated', () => {
  let s = createCity({ districts: [dist('d1')] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = r.state;
  s.landmarks[0].condition = 0.01;
  let t = s;
  for (let i = 0; i < 10; i++) t = applyMissedDay(t);
  expect(t.landmarks[0].condition).toBeGreaterThanOrEqual(0);
  expect(s.landmarks[0].condition).toBe(0.01);
  expect(t.day).toBe(s.day + 10);
});

it('sustained high condition raises landmark tier (sticky)', () => {
  let s = createCity({ districts: [dist('d1')] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = addHabit(r.state, hab('g', 'good', { kind: 'landmark', id: r.landmarkId }));
  s.landmarks[0].condition = 1;
  let t = s;
  for (let i = 0; i < 14; i++) t = applyCheckIn(t, { completedHabitIds: ['g'], loggedBadHabitIds: [] });
  expect(t.landmarks[0].tier).toBeGreaterThanOrEqual(1);
});

it('a thriving landmark rolls up to lift district health', () => {
  let s = createCity({ districts: [dist('d1', 0.5)] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L', condition: 0.95 });
  s = addHabit(r.state, hab('g', 'good', { kind: 'landmark', id: r.landmarkId }));
  // No district-direct habits, so the only contributor is the landmark.
  expect(districtHealth(s, s.districts[0])).toBeGreaterThan(0.9);
});

it('roll-up is weighted: a bigger contributor dominates', () => {
  let s = createCity({ districts: [dist('d1', 0.2)] });
  // Two heavy district-direct habits keep direct weight high vs a single-habit landmark.
  s = addHabit(s, hab('da', 'good', { kind: 'district', id: 'd1' }));
  s = addHabit(s, hab('db', 'good', { kind: 'district', id: 'd1' }));
  const r = addLandmark(s, { districtId: 'd1', name: 'L', condition: 1 });
  s = addHabit(r.state, hab('lg', 'good', { kind: 'landmark', id: r.landmarkId }));
  const h = districtHealth(s, s.districts[0]);
  // weighted avg of (0.2 * 2) and (1 * 1) = 1.4/3 ≈ 0.467 — pulled toward the heavier direct side
  expect(h).toBeGreaterThan(0.2);
  expect(h).toBeLessThan(0.6);
});

it('maturity accrues at pristine and unlocks features', () => {
  let s = createCity({ districts: [dist('d1', 1)] });
  s = addHabit(s, hab('g', 'good', { kind: 'district', id: 'd1' }));
  let t = s;
  for (let i = 0; i < 10; i++) t = applyCheckIn(t, { completedHabitIds: ['g'], loggedBadHabitIds: [] });
  expect(t.districts[0].maturity).toBeGreaterThan(0);
  expect(t.districts[0].features).toContain('fountain');
  expect(t.districts[0].features.includes('gardens')).toBe(false);
});

it('add and remove milestones', () => {
  let s = createCity({ districts: [dist('d1')] });
  s = addMilestone(s, { id: 'm1', label: 'Wedding', dateISO: '2014-06-14' });
  s = addMilestone(s, { id: 'm2', label: 'Moved', dateISO: '2019-03-01' });
  expect(s.milestones).toHaveLength(2);
  s = removeMilestone(s, 'm1');
  expect(s.milestones).toHaveLength(1);
  expect(s.milestones[0].label).toBe('Moved');
});

it('removal cooldown: request, blocked confirm, cancel, allowed confirm', () => {
  let s = createCity({ districts: [dist('d1')] });
  s = addHabit(s, hab('g', 'good', { kind: 'district', id: 'd1' }));
  s = requestHabitRemoval(s, 'g', '2026-06-20');
  expect(s.habits[0].pendingRemovalSinceISO).toBe('2026-06-20');
  // 1 day later → still blocked
  expect(confirmHabitRemoval(s, 'g', '2026-06-21').habits).toHaveLength(1);
  // cancel clears the flag
  expect(cancelHabitRemoval(s, 'g').habits[0].pendingRemovalSinceISO).toBe(undefined);
  // 2 days later → removed
  expect(confirmHabitRemoval(s, 'g', '2026-06-22').habits).toHaveLength(0);
});
