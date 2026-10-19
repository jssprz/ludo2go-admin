import assert from 'node:assert/strict';
import test from 'node:test';
import { courierSchema, courierTrackingUrl } from '../lib/courier';

test('builds tracking URLs with encoded tracking numbers', () => {
  assert.equal(courierTrackingUrl('https://courier.test/track/{trackingNumber}?number={trackingNumber}', ' AB/12 &3 '), 'https://courier.test/track/AB%2F12%20%263?number=AB%2F12%20%263');
  assert.equal(courierTrackingUrl(null, '123'), null);
  assert.equal(courierTrackingUrl('https://courier.test/{trackingNumber}', ' '), null);
});

test('validates courier templates and normalizes empty templates', () => {
  assert.deepEqual(courierSchema.parse({ name: ' Courier ', trackingUrlTemplate: '' }), { name: 'Courier', trackingUrlTemplate: null });
  for (const trackingUrlTemplate of ['javascript:alert({trackingNumber})', 'https://courier.test/track', 'invalid/{trackingNumber}', 'https://user:password@courier.test/{trackingNumber}']) {
    assert.equal(courierSchema.safeParse({ name: 'Courier', trackingUrlTemplate }).success, false);
  }
  assert.equal(courierSchema.safeParse({ name: ' ', trackingUrlTemplate: null }).success, false);
});