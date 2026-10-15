import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditOrderTracking, orderUpdateSchema } from '../lib/order-update';

test('ready_to_ship is a valid status and tracking-only updates are supported', () => {
  assert.deepEqual(orderUpdateSchema.parse({ status: 'ready_to_ship', courierTrackingNumber: '  TRACK-123  ' }), { status: 'ready_to_ship', courierTrackingNumber: 'TRACK-123' });
  assert.deepEqual(orderUpdateSchema.parse({ courierTrackingNumber: null }), { courierTrackingNumber: null });
  for (const input of [{}, { status: 'unknown' }, { courierTrackingNumber: 123 }, null]) assert.equal(orderUpdateSchema.safeParse(input).success, false);
});

test('tracking is editable only for ready_to_ship, shipped, delivered and cancelled', () => {
  for (const status of ['ready_to_ship', 'shipped', 'delivered', 'cancelled'] as const) assert.equal(canEditOrderTracking(status), true);
  for (const status of ['pending', 'confirmed', 'processing'] as const) assert.equal(canEditOrderTracking(status), false);
});