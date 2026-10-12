import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInventoryRecommendation } from '../lib/inventory-recommendations';

test('calculates reorder point from lead-time demand and variable-demand safety stock', () => {
  const recommendation = calculateInventoryRecommendation({
    weeklySales: [2, 4, 3, 5],
    available: 0,
    incoming: 0,
    leadTimeDays: 14,
    minimumOrderQuantity: 1,
  });

  assert.equal(recommendation.salesPerWeek, 3.5);
  assert.equal(recommendation.reorderPoint, 10);
  assert.equal(recommendation.priority, 'order_now');
  assert.ok(recommendation.suggestedQuantity > 0);
});

test('includes incoming inventory before assigning priority and suggested quantity', () => {
  const recommendation = calculateInventoryRecommendation({
    weeklySales: Array(12).fill(7),
    available: 5,
    incoming: 20,
    leadTimeDays: 7,
    minimumOrderQuantity: 1,
  });

  assert.equal(recommendation.priority, 'healthy');
  assert.equal(recommendation.suggestedQuantity, 0);
});

test('rounds the suggested quantity to pack size and honors MOQ', () => {
  const recommendation = calculateInventoryRecommendation({
    weeklySales: Array(12).fill(7),
    available: 0,
    incoming: 0,
    leadTimeDays: 7,
    minimumOrderQuantity: 10,
    packSize: 6,
  });

  assert.equal(recommendation.suggestedQuantity, 24);
});

test('does not recommend ordering products without observed sales', () => {
  const recommendation = calculateInventoryRecommendation({
    weeklySales: Array(12).fill(0),
    available: 0,
    incoming: 0,
    leadTimeDays: 30,
    minimumOrderQuantity: 5,
  });

  assert.equal(recommendation.priority, 'do_not_reorder');
  assert.equal(recommendation.daysOfCover, null);
  assert.equal(recommendation.suggestedQuantity, 0);
});