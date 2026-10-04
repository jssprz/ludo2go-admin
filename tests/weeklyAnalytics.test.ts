import test from 'node:test';
import assert from 'node:assert/strict';
import { getWeeklyReportPeriods } from '../lib/weekly-analytics-email';

test('weekly report uses completed Monday-to-Monday weeks in Santiago time', () => {
  const { current, previous } = getWeeklyReportPeriods(new Date('2026-10-05T12:00:00.000Z'));

  assert.equal(current.start.toISOString(), '2026-09-28T03:00:00.000Z');
  assert.equal(current.end.toISOString(), '2026-10-05T03:00:00.000Z');
  assert.equal(previous.start.toISOString(), '2026-09-21T03:00:00.000Z');
  assert.equal(previous.end.toISOString(), current.start.toISOString());
});

test('weekly window does not advance before Monday midnight in Santiago', () => {
  const { current } = getWeeklyReportPeriods(new Date('2026-10-05T02:59:00.000Z'));

  assert.equal(current.start.toISOString(), '2026-09-21T03:00:00.000Z');
  assert.equal(current.end.toISOString(), '2026-09-28T03:00:00.000Z');
});