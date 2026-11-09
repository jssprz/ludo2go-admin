import { expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { activeCartWhere, cartActivityStatusSql, getCartActivityCutoff } from '../lib/cart-activity';
import { buildCustomerCartDetailsSql } from '../lib/repositories/customer-cart';
import { buildCustomerListSql } from '../lib/repositories/customer-list';
import { parseCustomerListQuery } from '../lib/customer-list';

test('inactivity cutoff is exactly 30 elapsed days, including across Santiago DST changes', () => {
  for (const now of ['2026-11-09T11:00:00Z', '2026-09-20T00:00:00Z', '2026-04-20T00:00:00Z']) {
    const instant = new Date(now);
    expect(instant.getTime() - getCartActivityCutoff(instant).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  }
});

test('active predicate includes recent cart OR item updates, ignores stored abandonment, and excludes ordered carts', () => {
  const cutoff = new Date('2026-10-10T11:00:00Z');
  expect(activeCartWhere(cutoff)).toEqual({
    status: { in: ['active', 'abandoned'] },
    OR: [
      { updatedAt: { gt: cutoff } },
      { items: { some: { updatedAt: { gt: cutoff } } } },
    ],
  });
});

test('SQL classification uses the same strict 30-day boundary and correlated item activity', () => {
  expect(cartActivityStatusSql.values).toEqual([30, 30]);
  expect(cartActivityStatusSql.text).toContain('cart."updatedAt" > CURRENT_TIMESTAMP');
  expect(cartActivityStatusSql.text).toContain('activity_item."cartId" = cart."id"');
  expect(cartActivityStatusSql.text).toContain('activity_item."updatedAt" > CURRENT_TIMESTAMP');
  expect(cartActivityStatusSql.text).toContain("THEN 'active' ELSE 'abandoned' END");
  expect(cartActivityStatusSql.text).not.toContain('>=');
});

test('customer/visitor cart details and list queries derive status without mutating records', () => {
  const queries = [
    buildCustomerCartDetailsSql('customer', 'customer-1'),
    buildCustomerCartDetailsSql('visitor', 'visitor-1'),
    buildCustomerListSql(parseCustomerListQuery(new URLSearchParams({ cart: 'active' }))),
    buildCustomerListSql(parseCustomerListQuery(new URLSearchParams({ cart: 'abandoned', tab: 'visitors' }))),
  ];
  for (const query of queries) {
    expect(query.text).toContain('activity_item."updatedAt" > CURRENT_TIMESTAMP');
    expect(query.text).toContain("cart.status::text IN ('active', 'abandoned')");
    expect(query.text).not.toMatch(/\b(UPDATE|DELETE|INSERT)\b/);
    expect(query.values.filter((value) => value === 30)).toHaveLength(2);
  }
  expect(queries[2].text).toContain('cart.effective_status AS status');
  expect(queries[2].text).toContain('GROUP BY cart."id", cart.owner_id, cart."visitorId", cart."updatedAt", cart.effective_status');
});
