import { expect, test } from 'vitest';
import { calculateOrderProfit, type OrderProfitCostPrice } from '../lib/order-profit';

const createdAt = new Date('2026-07-14T12:00:00Z');

const item = {
  id: 'item-1',
  variantId: 'variant-1',
  quantity: 3,
  cancelledQuantity: 1,
  unitPrice: 2000,
  currency: 'CLP',
  isGift: false,
};

const costPrice: OrderProfitCostPrice = {
  variantId: 'variant-1',
  amount: 1000,
  currency: 'CLP',
  taxIncluded: true,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'),
  effectiveTo: null,
};

test('calculates gross gain for the remaining paid quantity', () => {
  expect(calculateOrderProfit(
    { createdAt, status: 'delivered', currency: 'CLP', items: [item] },
    [costPrice],
    []
  )).toEqual({
    total: 2000,
    lines: [{ itemId: 'item-1', amount: 2000 }],
  });
});

test('prefers the cost price effective at order time, falling back to any active cost', () => {
  const future = { ...costPrice, amount: 500, taxIncluded: true, effectiveFrom: new Date('2026-08-01T00:00:00Z') };
  const run = (costs: OrderProfitCostPrice[]) => calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', items: [item] }, costs, []
  ).total;
  expect(run([future, costPrice])).toBe(2000);
  expect(run([future])).toBe(3000);
});

test('includes the cost of gift items and returns unavailable for missing or mismatched costs', () => {
  const gift = { ...item, isGift: true };
  expect(calculateOrderProfit({ createdAt, status: 'processing', currency: 'CLP', items: [gift] }, [costPrice], []).total)
    .toBe(-2000);
  expect(calculateOrderProfit({ createdAt, status: 'processing', currency: 'CLP', items: [item] }, [], []).total)
    .toBeNull();
  expect(calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', items: [{ ...item, currency: 'USD' }] },
    [costPrice],
    []
  ).total).toBeNull();
});

test('prefers the latest purchase cost, as the Inventory page does', () => {
  const purchase = {
    variantId: 'variant-1',
    unitCost: 500,
    quantity: 1,
    discount: 0,
    purchaseOrder: {
      createdAt: new Date('2026-07-01T00:00:00Z'),
      currency: 'CLP',
      subtotal: 500,
      tax: 95,
      shipping: 0,
      items: [{ discount: 0 }],
    },
  };
  expect(calculateOrderProfit(
    { createdAt, status: 'processing', currency: 'CLP', items: [item] },
    [costPrice],
    [purchase]
  ).total).toBe(2810);
});

test('treats a cancelled order as no sale', () => {
  expect(calculateOrderProfit({ createdAt, status: 'cancelled', currency: 'CLP', items: [item] }, [], []).total).toBe(0);
});
