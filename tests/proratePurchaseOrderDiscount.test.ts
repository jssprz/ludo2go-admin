import test from 'node:test';
import assert from 'node:assert/strict';
import { proratePurchaseOrderDiscount } from '../lib/prorate-purchase-order-discount';

test('prorates a discount by line gross value', () => {
  assert.deepEqual(proratePurchaseOrderDiscount([
    { quantity: 2, unitCost: 100 },
    { quantity: 1, unitCost: 400 },
  ], 150), [50, 100]);
});

test('assigns rounding remainder deterministically without losing units', () => {
  assert.deepEqual(proratePurchaseOrderDiscount([
    { quantity: 1, unitCost: 1 },
    { quantity: 1, unitCost: 1 },
    { quantity: 1, unitCost: 1 },
  ], 2), [1, 1, 0]);
});

test('zero-value items do not receive a discount', () => {
  assert.deepEqual(proratePurchaseOrderDiscount([
    { quantity: 1, unitCost: 0 },
    { quantity: 1, unitCost: 5 },
  ], 5), [0, 5]);
  assert.deepEqual(proratePurchaseOrderDiscount([], 0), []);
});

test('rejects discounts beyond the gross total or with fractional units', () => {
  const items = [{ quantity: 1, unitCost: 5 }];
  assert.throws(() => proratePurchaseOrderDiscount(items, 6));
  assert.throws(() => proratePurchaseOrderDiscount(items, -1));
  assert.throws(() => proratePurchaseOrderDiscount(items, 1.5));
});