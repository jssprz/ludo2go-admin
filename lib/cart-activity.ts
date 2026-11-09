import { Prisma } from '@prisma/client';

export const CART_INACTIVITY_DAYS = 30;

export type CartActivityCounts = {
  active: number;
  abandoned: number;
  customers: { active: number; abandoned: number };
  anonymousVisitors: { active: number; abandoned: number };
};

export function getCartActivityCutoff(now = new Date()): Date {
  return new Date(now.getTime() - CART_INACTIVITY_DAYS * 24 * 60 * 60 * 1000);
}

export function activeCartWhere(cutoff = getCartActivityCutoff()): Prisma.CartWhereInput {
  return {
    status: { in: ['active', 'abandoned'] },
    OR: [
      { updatedAt: { gt: cutoff } },
      { items: { some: { updatedAt: { gt: cutoff } } } },
    ],
  };
}

// SQL callers use "cart" as the cart table alias.
export function buildCartActivityStatusSql(
  cutoff = Prisma.sql`CURRENT_TIMESTAMP - ${CART_INACTIVITY_DAYS} * interval '1 day'`
): Prisma.Sql {
  return Prisma.sql`CASE
  WHEN cart."updatedAt" > ${cutoff}
    OR EXISTS (SELECT 1 FROM "CartItem" activity_item
      WHERE activity_item."cartId" = cart."id"
        AND activity_item."updatedAt" > ${cutoff})
  THEN 'active' ELSE 'abandoned' END`;
}

export const cartActivityStatusSql = buildCartActivityStatusSql();
