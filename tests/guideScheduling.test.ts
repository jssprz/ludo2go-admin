import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGuideSchedule, guideScheduleInputToIso } from '../lib/guide-scheduling';

const now = new Date('2026-10-14T12:00:00Z');
test('scheduled status requires a valid future timezone-qualified date', () => {
  for (const value of [null, undefined, '', 'bad', '2026-10-14T10:00', '2026-10-14T12:00:00Z', '2026-10-13T12:00:00Z']) {
    assert.ok(parseGuideSchedule('scheduled', value, now).error);
  }
  assert.equal(parseGuideSchedule('scheduled', '2026-10-15T10:00:00-03:00', now).scheduledAt?.toISOString(), '2026-10-15T13:00:00.000Z');
});
test('other statuses clear scheduling and invalid statuses are rejected', () => {
  for (const status of ['draft', 'published', 'archived']) assert.equal(parseGuideSchedule(status, '2026-10-15T12:00:00Z', now).scheduledAt, null);
  assert.ok(parseGuideSchedule('unknown', null, now).error);
});
test('local date inputs become UTC instants and empty or invalid values are rejected', () => {
  assert.equal(guideScheduleInputToIso(''), null);
  assert.equal(guideScheduleInputToIso('bad'), null);
  const value = '2026-10-15T10:30';
  assert.equal(guideScheduleInputToIso(value), new Date(value).toISOString());
});