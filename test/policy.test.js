import test from 'node:test';
import assert from 'node:assert/strict';
import { changePolicy, effective, countdown, EMPTY_POLICY } from '../policy.js';
const all = { conversation: true, feedback: true, stop: true, review: true, privacy: true, copy: true };
test('timed closure expires exactly at the boundary; permanent closure remains', () => {
  const until = '2026-12-01T10:30:00+08:00';
  const end = Date.parse(until);
  const p = changePolicy({}, { feature: 'conversation', enabled: true, until }, all, end - 1000);
  assert.equal(effective(p, all, end - 1).closed, true);
  assert.equal(effective(p, all, end).closed, false);
  assert.equal(effective(changePolicy({}, { feature: 'conversation', enabled: true }, all), all, end).closed, true);
  assert.deepEqual(countdown(end, end - 3661000), { hours: 1, minutes: 1, seconds: 1 });
});
test('ambiguous timestamps, invalid dates and past deadlines are rejected', () => {
  for (const until of ['2026-12-01T10:30:00', 'invalid', '2020-01-01T00:00:00Z']) {
    assert.throws(() => changePolicy({}, { feature: 'conversation', enabled: true, until }, all));
  }
});
test('feedback restrictions are independent and reversible', () => {
  const p = changePolicy({}, { feature: 'feedback', enabled: true, target: 'negative' }, all);
  assert.equal(p.positive, false); assert.equal(p.negative, true);
  const both = changePolicy(p, { feature: 'feedback', enabled: true, target: 'both' }, all);
  assert.equal(both.positive && both.negative, true);
  const released = changePolicy(both, { feature: 'feedback', enabled: false, target: 'positive' }, all);
  assert.equal(released.positive, false); assert.equal(released.negative, true);
  assert.throws(() => changePolicy({}, { feature: 'feedback', enabled: true }, all));
});
test('user feature switches mask existing restrictions and forbid model changes', () => {
  const features = { ...all, copy: false, conversation: false };
  assert.equal(effective({ ...EMPTY_POLICY, copy: true, closed: true }, features).copy, false);
  assert.equal(effective({ ...EMPTY_POLICY, copy: true, closed: true }, features).closed, false);
  assert.throws(() => changePolicy({}, { feature: 'copy', enabled: true }, features), /disabled by the user/);
  assert.throws(() => changePolicy({}, { feature: 'nonexistent', enabled: true }, all));
  assert.throws(() => changePolicy({}, { feature: 'copy', enabled: 'true' }, all));
});
