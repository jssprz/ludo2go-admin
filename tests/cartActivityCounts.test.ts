import { expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildCartActivityCountsSql, getCartActivityCounts } from '../lib/repositories/cart-activity';

const cutoff = new Date('2026-10-10T11:00:00Z');

test('ownership attribution prefers explicit customers and only infers unique visitor identities', () => {
  const query = buildCartActivityCountsSql(cutoff);
  expect(query.text).toContain('count(DISTINCT e."customerId") AS identified_count');
  expect(query.text).toContain('GROUP BY s."visitorId"');
  expect(query.text).toContain('COALESCE(cart."customerId",');
  expect(query.text).toContain('CASE WHEN v.identified_count = 1 THEN v.customer_id END');
  expect(query.text).toContain('LEFT JOIN visitor_identity');
  expect(query.text).toContain("cart.status::text IN ('active', 'abandoned')");
  expect(query.text).toContain('activity_item."updatedAt" >');
  expect(query.values).toEqual([cutoff, cutoff]);
  for (const activity of ['active', 'abandoned']) {
    expect(query.text).toContain(`activity = '${activity}' AND has_customer`);
    expect(query.text).toContain(`activity = '${activity}' AND NOT has_customer`);
  }
  expect(query.text).not.toMatch(/\b(UPDATE|DELETE|INSERT)\b/);
});

test('customer and anonymous breakdowns reconcile exactly with totals', async () => {
  const $queryRaw = vi.fn().mockResolvedValue([{
    customerActive: 11,
    customerAbandoned: 7,
    anonymousActive: 13,
    anonymousAbandoned: 5,
  }]);
  expect(await getCartActivityCounts(cutoff, { $queryRaw })).toEqual({
    active: 24,
    abandoned: 12,
    customers: { active: 11, abandoned: 7 },
    anonymousVisitors: { active: 13, abandoned: 5 },
  });
  expect($queryRaw).toHaveBeenCalledTimes(1);
});

test('missing aggregate results fail explicitly rather than reporting zero', async () => {
  const $queryRaw = vi.fn().mockResolvedValue([]);
  await expect(getCartActivityCounts(cutoff, { $queryRaw })).rejects.toThrow('Cart activity counts are unavailable');
});
