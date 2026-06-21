import { it, expect } from '../testkit.ts';
import { createCity, applyCheckIn, applyMissedDay, addLandmark, addHabit } from './engine.ts';
import type { District } from './types.ts';

const d: District = { id: 'd1', name: 'D', description: '', health: 0.5 };

it('good habit raises landmark condition; missing it lowers slightly', () => {
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = addHabit(r.state, { id: 'h1', name: 'do', kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  const before = s.landmarks[0].condition;
  const up = applyCheckIn(s, { completedHabitIds: ['h1'], loggedBadHabitIds: [] });
  expect(up.landmarks[0].condition).toBeGreaterThan(before);
  const down = applyCheckIn(s, { completedHabitIds: [], loggedBadHabitIds: [] });
  expect(down.landmarks[0].condition).toBeLessThan(before);
});

it('neglect gradient: bad habit > missed habit > missed checkin', () => {
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = r.state;
  s = addHabit(s, { id: 'g', name: 'g', kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  s = addHabit(s, { id: 'b', name: 'b', kind: 'bad', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  const start = 0.8;
  s.landmarks[0].condition = start;
  const badHit = start - applyCheckIn(s, { completedHabitIds: ['g'], loggedBadHabitIds: ['b'] }).landmarks[0].condition;
  const missHabit = start - applyCheckIn(s, { completedHabitIds: [], loggedBadHabitIds: [] }).landmarks[0].condition;
  const missCheckin = start - applyMissedDay(s).landmarks[0].condition;
  expect(badHit).toBeGreaterThan(missHabit);
  expect(missHabit).toBeGreaterThan(missCheckin);
});

it('one missed day is small, three weeks is large (weeks not days)', () => {
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = r.state;
  s = addHabit(s, { id: 'g', name: 'g', kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  s.landmarks[0].condition = 1;
  const oneDay = 1 - applyMissedDay(s).landmarks[0].condition;
  let t = s;
  for (let i = 0; i < 21; i++) t = applyMissedDay(t);
  expect(oneDay).toBeLessThan(0.05);
  expect(1 - t.landmarks[0].condition).toBeGreaterThan(0.3);
});

it('condition clamps to [0,1] and state is not mutated', () => {
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = r.state;
  s.landmarks[0].condition = 0.01;
  let t = s;
  for (let i = 0; i < 10; i++) t = applyMissedDay(t);
  expect(t.landmarks[0].condition).toBeGreaterThanOrEqual(0);
  expect(s.landmarks[0].condition).toBe(0.01);
  expect(t.day).toBe(s.day + 10);
});

it('sustained high condition raises tier (sticky)', () => {
  let s = createCity({ districts: [d] });
  const r = addLandmark(s, { districtId: 'd1', name: 'L' });
  s = r.state;
  s = addHabit(s, { id: 'g', name: 'g', kind: 'good', target: { kind: 'landmark', landmarkId: r.landmarkId } });
  s.landmarks[0].condition = 1;
  let t = s;
  for (let i = 0; i < 14; i++) t = applyCheckIn(t, { completedHabitIds: ['g'], loggedBadHabitIds: [] });
  expect(t.landmarks[0].tier).toBeGreaterThanOrEqual(1);
});

it('district-targeted habits drive district health', () => {
  let s = createCity({ districts: [{ ...d, health: 0.5 }] });
  s = addHabit(s, { id: 'dh', name: 'walk', kind: 'good', target: { kind: 'district', districtId: 'd1' } });
  const up = applyCheckIn(s, { completedHabitIds: ['dh'], loggedBadHabitIds: [] });
  expect(up.districts[0].health).toBeGreaterThan(0.5);
});
