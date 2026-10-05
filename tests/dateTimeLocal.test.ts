import test from 'node:test';
import assert from 'node:assert/strict';
import { toDateTimeLocalInput } from '../lib/date-time-local';

test('formats stored instants as local datetime input values without changing the instant on save', () => {
  const storedValue = '2026-10-05T15:30:00.000Z';
  const inputValue = toDateTimeLocalInput(storedValue);

  assert.equal(inputValue, '2026-10-05T12:30');
  assert.equal(new Date(inputValue).toISOString(), storedValue);
});

test('returns an empty datetime input for missing or invalid dates', () => {
  assert.equal(toDateTimeLocalInput(null), '');
  assert.equal(toDateTimeLocalInput('not-a-date'), '');
});