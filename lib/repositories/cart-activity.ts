import 'server-only';
import { Prisma } from '@prisma/client';
import { buildCartActivityStatusSql, type CartActivityCounts } from '../cart-activity';

type ReadDatabase = {
  $queryRaw<Result = unknown>(query: Prisma.Sql): Promise<Result>;
};

export function buildCartActivityCountsSql(cutoff: Date): Prisma.Sql {
  return Prisma.sql`WITH visitor_identity AS (
    SELECT s."visitorId", count(DISTINCT e."customerId") AS identified_count,
      min(e."customerId") AS customer_id
    FROM "Session" s JOIN "Event" e ON e."sessionId" = s."id"
    WHERE e."customerId" IS NOT NULL
    GROUP BY s."visitorId"
  ), classified_carts AS (
    SELECT ${buildCartActivityStatusSql(Prisma.sql`${cutoff}::timestamp`)} AS activity,
      COALESCE(cart."customerId",
        CASE WHEN v.identified_count = 1 THEN v.customer_id END) IS NOT NULL AS has_customer
    FROM "Cart" cart LEFT JOIN visitor_identity v ON v."visitorId" = cart."visitorId"
    WHERE cart.status::text IN ('active', 'abandoned')
  )
  SELECT
    count(*) FILTER (WHERE activity = 'active' AND has_customer)::int AS "customerActive",
    count(*) FILTER (WHERE activity = 'abandoned' AND has_customer)::int AS "customerAbandoned",
    count(*) FILTER (WHERE activity = 'active' AND NOT has_customer)::int AS "anonymousActive",
    count(*) FILTER (WHERE activity = 'abandoned' AND NOT has_customer)::int AS "anonymousAbandoned"
  FROM classified_carts`;
}

export async function getCartActivityCounts(
  cutoff: Date,
  database: ReadDatabase
): Promise<CartActivityCounts> {
  const [counts] = await database.$queryRaw<Array<{
    customerActive: number;
    customerAbandoned: number;
    anonymousActive: number;
    anonymousAbandoned: number;
  }>>(buildCartActivityCountsSql(cutoff));
  if (!counts) throw new Error('Cart activity counts are unavailable.');
  return {
    active: counts.customerActive + counts.anonymousActive,
    abandoned: counts.customerAbandoned + counts.anonymousAbandoned,
    customers: { active: counts.customerActive, abandoned: counts.customerAbandoned },
    anonymousVisitors: { active: counts.anonymousActive, abandoned: counts.anonymousAbandoned },
  };
}
