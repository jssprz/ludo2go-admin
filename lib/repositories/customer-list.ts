import 'server-only';
import { Prisma } from '@prisma/client';
import type { CustomerListQuery, CustomerListPage, CustomerDuplicatePage, CustomerDuplicateReview } from '../customer-list';
import { parseCustomerListQuery, parseCustomerListReviewIds } from '../customer-list';

type ReadDatabase = {
  $queryRaw<Result = unknown>(query: Prisma.Sql): Promise<Result>;
};

const identityCtes = Prisma.sql`
  identity_base AS (
    SELECT c."id", c."email", c."phone", c."createdAt", c."firstName", c."lastName", c."username",
      COALESCE(NULLIF(trim(c."preferredCurrency"), ''), 'CLP') AS currency,
      COALESCE(NULLIF(trim(concat_ws(' ', NULLIF(trim(c."firstName"), ''), NULLIF(trim(c."lastName"), ''))), ''),
        NULLIF(trim(c."username"), ''), c."email") AS name,
      lower(trim(c."email")) AS email_key,
      regexp_replace(regexp_replace(COALESCE(c."phone", ''), '[^0-9]', '', 'g'), '^00', '') AS phone_digits,
      lower(regexp_replace(trim(concat_ws(' ', c."firstName", c."lastName")), '[[:space:]]+', ' ', 'g')) AS name_key
    FROM "Customer" c
  ), identities AS (
    SELECT *, CASE WHEN phone_digits ~ '^9[0-9]{8}$' THEN '56' || phone_digits ELSE phone_digits END AS phone_key
    FROM identity_base
  ), identity_counts AS (
    SELECT *, count(*) OVER (PARTITION BY email_key) AS email_matches,
      count(*) OVER (PARTITION BY phone_key) AS phone_matches,
      count(*) OVER (PARTITION BY name_key) AS name_matches
    FROM identities
  ), customer_identity AS (
    SELECT *, array_remove(ARRAY[
      CASE WHEN email_key !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN 'invalidEmail' END,
      CASE WHEN concat_ws(' ', email_key, "firstName", "lastName", "username") ~* '(^|[^a-z])(test|demo|example|localhost|invalid)([^a-z]|$)' THEN 'testAccount' END,
      CASE WHEN NULLIF(trim("firstName"), '') IS NULL OR NULLIF(trim("lastName"), '') IS NULL OR NULLIF(trim("phone"), '') IS NULL THEN 'incomplete' END,
      CASE WHEN (email_key <> '' AND email_matches > 1) OR (length(phone_key) >= 8 AND phone_matches > 1)
        OR (name_key LIKE '% %' AND name_matches > 1) THEN 'duplicate' END
    ], NULL) AS quality
    FROM identity_counts
  )`;

const aggregateCtes = Prisma.sql`
  ${identityCtes},
  session_identity AS (
    SELECT s."id", s."visitorId", count(DISTINCT e."customerId") AS identified_count, min(e."customerId") AS customer_id
    FROM "Session" s LEFT JOIN "Event" e ON e."sessionId" = s."id"
    GROUP BY s."id", s."visitorId"
  ), visitor_identity AS (
    SELECT s."visitorId", count(DISTINCT e."customerId") AS identified_count, min(e."customerId") AS customer_id
    FROM "Session" s LEFT JOIN "Event" e ON e."sessionId" = s."id"
    GROUP BY s."visitorId"
  ), attributed_events AS (
    SELECT e."eventType"::text AS event_type, e."occurredAt", s."visitorId",
      COALESCE(e."customerId", CASE WHEN s.identified_count = 1 THEN s.customer_id END,
        CASE WHEN v.identified_count = 1 THEN v.customer_id END) AS customer_id
    FROM "Event" e JOIN session_identity s ON s."id" = e."sessionId"
    JOIN visitor_identity v ON v."visitorId" = s."visitorId"
  ), customer_event_types AS (
    SELECT customer_id, event_type, count(*)::int AS amount, max("occurredAt") AS last_activity
    FROM attributed_events WHERE customer_id IS NOT NULL GROUP BY customer_id, event_type
  ), customer_events AS (
    SELECT customer_id, max(last_activity) AS last_activity,
      jsonb_object_agg(event_type, amount) AS activity_summary
    FROM customer_event_types GROUP BY customer_id
  ), customer_sessions AS (
    SELECT COALESCE(CASE WHEN s.identified_count = 1 THEN s.customer_id END,
      CASE WHEN v.identified_count = 1 THEN v.customer_id END) AS customer_id,
      max(raw."lastActivityAt") AS last_activity
    FROM session_identity s JOIN "Session" raw ON raw."id" = s."id"
    JOIN visitor_identity v ON v."visitorId" = s."visitorId"
    GROUP BY 1
  ), refunds AS (
    SELECT "orderId", currency, sum(GREATEST(amount, 0)::numeric) AS amount
    FROM "Payment" WHERE status = 'refunded' GROUP BY "orderId", currency
  ), completed_orders AS (
    SELECT o."customerId", count(*)::int AS orders_count, max(o."createdAt") AS last_purchase,
      min(o."createdAt") AS first_purchase,
      sum(GREATEST(0, o.total::numeric - COALESCE(r.amount, 0))) AS ltv
    FROM "Order" o JOIN customer_identity c ON c."id" = o."customerId" AND c.currency = o.currency
    LEFT JOIN refunds r ON r."orderId" = o."id" AND r.currency = o.currency
    WHERE o.status::text = 'delivered' GROUP BY o."customerId"
  ), owned_carts AS (
    SELECT cart.*, COALESCE(cart."customerId", CASE WHEN v.identified_count = 1 THEN v.customer_id END) AS owner_id
    FROM "Cart" cart LEFT JOIN visitor_identity v ON v."visitorId" = cart."visitorId"
    WHERE cart.status::text IN ('active', 'abandoned')
  ), cart_values AS (
    SELECT cart."id", cart.owner_id, cart."visitorId", cart."updatedAt", cart.status::text AS status,
      sum(GREATEST(item.quantity, 0)::numeric * GREATEST(COALESCE(item."unitPriceAtAdd", price.amount, 0), 0)) AS value,
      count(item."id")::int AS items_count
    FROM owned_carts cart LEFT JOIN customer_identity c ON c."id" = cart.owner_id
    LEFT JOIN "CartItem" item ON item."cartId" = cart."id"
    LEFT JOIN LATERAL (
      SELECT p.amount FROM "Price" p WHERE p."variantId" = item."variantId"
        AND p.currency::text = COALESCE(c.currency, 'CLP') AND p.type::text = 'retail' AND p.active
        AND p."priceBookId" IS NULL AND p."channelId" IS NULL AND p.region IS NULL
        AND (p."startsAt" IS NULL OR p."startsAt" <= CURRENT_TIMESTAMP)
        AND (p."endsAt" IS NULL OR p."endsAt" > CURRENT_TIMESTAMP)
      ORDER BY p."createdAt" DESC, p."id" ASC LIMIT 1
    ) price ON true
    GROUP BY cart."id", cart.owner_id, cart."visitorId", cart."updatedAt", cart.status
  ), customer_carts AS (
    SELECT owner_id, count(*) FILTER (WHERE status = 'active' AND items_count > 0)::int AS cart_count,
      COALESCE(sum(value) FILTER (WHERE status = 'active'), 0) AS cart_value,
      bool_or(status = 'abandoned' AND items_count > 0) AS abandoned, max("updatedAt") AS last_activity
    FROM cart_values WHERE owner_id IS NOT NULL GROUP BY owner_id
  ), customer_metrics AS (
    SELECT c."id", c.name, c."email", c."phone", c."createdAt", c.currency, c.quality,
      COALESCE(o.ltv, 0) AS ltv, COALESCE(o.orders_count, 0) AS orders_count,
      CASE WHEN o.orders_count > 0 THEN o.ltv / o.orders_count ELSE 0 END AS aov,
      o.last_purchase, GREATEST(e.last_activity, s.last_activity, o.last_purchase, cart.last_activity) AS last_activity,
      COALESCE(cart.cart_value, 0) AS cart_value, COALESCE(cart.cart_count, 0) AS cart_count,
      COALESCE(cart.abandoned, false) AS abandoned, COALESCE(e.activity_summary, '{}'::jsonb) AS activity_summary,
      CASE WHEN o.orders_count < 3 OR o.orders_count IS NULL OR o.last_purchase <= o.first_purchase THEN 'insufficient'
        WHEN o.last_purchase < CURRENT_TIMESTAMP - interval '150 days' THEN 'high'
        WHEN o.last_purchase < CURRENT_TIMESTAMP - interval '90 days'
          OR extract(epoch FROM (CURRENT_TIMESTAMP - o.last_purchase)) >
            extract(epoch FROM (o.last_purchase - o.first_purchase)) / (o.orders_count - 1) * 2 THEN 'medium'
        ELSE 'low' END AS risk
    FROM customer_identity c LEFT JOIN completed_orders o ON o."customerId" = c."id"
    LEFT JOIN customer_events e ON e.customer_id = c."id" LEFT JOIN customer_sessions s ON s.customer_id = c."id"
    LEFT JOIN customer_carts cart ON cart.owner_id = c."id"
  ), customers AS (
    SELECT *, CASE WHEN risk = 'high' THEN 'atRisk'
      WHEN COALESCE(last_activity, "createdAt") < CURRENT_TIMESTAMP - interval '90 days' THEN 'inactive'
      WHEN orders_count >= 5 AND last_purchase >= CURRENT_TIMESTAMP - interval '60 days' THEN 'vip'
      WHEN orders_count >= 2 THEN 'repeat'
      WHEN "createdAt" >= CURRENT_TIMESTAMP - interval '30 days' THEN 'new'
      ELSE NULL END AS segment,
      CASE risk WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END AS risk_rank
    FROM customer_metrics
  ), anonymous AS (
    SELECT v."id", v."createdAt" FROM "Visitor" v LEFT JOIN visitor_identity i ON i."visitorId" = v."id"
    WHERE COALESCE(i.identified_count, 0) = 0
  ), visitor_sessions AS (
    SELECT s."visitorId", count(*)::int AS sessions_count, max(s."lastActivityAt") AS last_activity
    FROM "Session" s JOIN anonymous a ON a."id" = s."visitorId" GROUP BY s."visitorId"
  ), visitor_event_types AS (
    SELECT e."visitorId", e.event_type, count(*)::int AS amount, max(e."occurredAt") AS last_activity
    FROM attributed_events e JOIN anonymous a ON a."id" = e."visitorId" GROUP BY e."visitorId", e.event_type
  ), visitor_events AS (
    SELECT "visitorId", sum(amount)::int AS events_count, max(last_activity) AS last_activity,
      jsonb_object_agg(event_type, amount) AS activity_summary FROM visitor_event_types GROUP BY "visitorId"
  ), visitor_carts AS (
    SELECT cart."visitorId", count(*) FILTER (WHERE status = 'active' AND items_count > 0)::int AS cart_count,
      COALESCE(sum(value) FILTER (WHERE status = 'active'), 0) AS cart_value,
      bool_or(status = 'abandoned' AND items_count > 0) AS abandoned, max(cart."updatedAt") AS last_activity
    FROM cart_values cart JOIN anonymous a ON a."id" = cart."visitorId"
    WHERE cart.owner_id IS NULL GROUP BY cart."visitorId"
  ), visitors AS (
    SELECT a.*, COALESCE(s.sessions_count, 0) AS sessions_count, COALESCE(e.events_count, 0) AS events_count,
      GREATEST(s.last_activity, e.last_activity, cart.last_activity) AS last_activity,
      COALESCE(cart.cart_count, 0) AS cart_count, COALESCE(cart.cart_value, 0) AS cart_value,
      COALESCE(cart.abandoned, false) AS abandoned, COALESCE(e.activity_summary, '{}'::jsonb) AS activity_summary
    FROM anonymous a LEFT JOIN visitor_sessions s ON s."visitorId" = a."id"
    LEFT JOIN visitor_events e ON e."visitorId" = a."id" LEFT JOIN visitor_carts cart ON cart."visitorId" = a."id"
  )`;

function activityFilter(query: CustomerListQuery): Prisma.Sql {
  if (!query.activity) return Prisma.sql`true`;
  if (query.activity === 'inactive') return Prisma.sql`COALESCE(last_activity, "createdAt") < CURRENT_TIMESTAMP - interval '90 days'`;
  return Prisma.sql`last_activity >= CURRENT_TIMESTAMP - ${Number(query.activity)} * interval '1 day'`;
}

function cartFilter(query: CustomerListQuery): Prisma.Sql {
  if (query.cart === 'active') return Prisma.sql`cart_count > 0`;
  if (query.cart === 'abandoned') return Prisma.sql`abandoned`;
  return Prisma.sql`true`;
}

function customerFilter(query: CustomerListQuery): Prisma.Sql {
  const conditions = [activityFilter(query), cartFilter(query)];
  if (query.q) {
    const search = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(Prisma.sql`(name ILIKE ${search} OR "email" ILIKE ${search} OR "phone" ILIKE ${search} OR "id" ILIKE ${search})`);
  }
  if (query.segment === 'new') conditions.push(Prisma.sql`"createdAt" >= CURRENT_TIMESTAMP - interval '30 days'`);
  if (query.segment === 'repeat') conditions.push(Prisma.sql`orders_count >= 2`);
  if (query.segment === 'vip') conditions.push(Prisma.sql`orders_count >= 5 AND last_purchase >= CURRENT_TIMESTAMP - interval '60 days'`);
  if (query.segment === 'inactive') conditions.push(Prisma.sql`COALESCE(last_activity, "createdAt") < CURRENT_TIMESTAMP - interval '90 days'`);
  if (query.segment === 'atRisk') conditions.push(Prisma.sql`risk = 'high'`);
  if (query.purchase === 'none') conditions.push(Prisma.sql`orders_count = 0`);
  if (query.purchase === 'one') conditions.push(Prisma.sql`orders_count = 1`);
  if (query.purchase === 'repeat') conditions.push(Prisma.sql`orders_count >= 2`);
  if (query.risk) conditions.push(Prisma.sql`risk = ${query.risk}`);
  if (query.quality === 'flagged') conditions.push(Prisma.sql`cardinality(quality) > 0`);
  if (query.quality === 'duplicate') conditions.push(Prisma.sql`'duplicate' = ANY(quality)`);
  if (query.quality === 'internal') conditions.push(Prisma.sql`'testAccount' = ANY(quality)`);
  return Prisma.join(conditions, ' AND ');
}

function visitorFilter(query: CustomerListQuery): Prisma.Sql {
  const conditions = [activityFilter(query), cartFilter(query)];
  if (query.q) conditions.push(Prisma.sql`"id" ILIKE ${`%${query.q.replace(/[\\%_]/g, '\\$&')}%`}`);
  if (query.segment || (query.purchase && query.purchase !== 'none') || (query.risk && query.risk !== 'insufficient') || query.quality) conditions.push(Prisma.sql`false`);
  return Prisma.join(conditions, ' AND ');
}

function sortSql(query: CustomerListQuery, visitors = false): Prisma.Sql {
  const customerColumns: Record<CustomerListQuery['sort'], Prisma.Sql> = {
    name: Prisma.sql`lower(name)`, email: Prisma.sql`lower("email")`, ltv: Prisma.sql`ltv`, orders: Prisma.sql`orders_count`,
    lastPurchase: Prisma.sql`last_purchase`, lastActivity: Prisma.sql`last_activity`, cartValue: Prisma.sql`cart_value`, risk: Prisma.sql`risk_rank`
  };
  const column = visitors
    ? query.sort === 'cartValue' ? Prisma.sql`cart_value` : query.sort === 'name' || query.sort === 'email' ? Prisma.sql`"id"` : Prisma.sql`last_activity`
    : customerColumns[query.sort];
  return Prisma.sql`${column} ${query.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`} NULLS LAST, "id" ASC`;
}

export function buildCustomerListSql(input: CustomerListQuery): Prisma.Sql {
  const query = parseCustomerListQuery(new URLSearchParams(Object.entries(input).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])));
  return Prisma.sql`WITH ${aggregateCtes},
    filtered_customers AS (SELECT * FROM customers WHERE ${customerFilter(query)}),
    filtered_visitors AS (SELECT * FROM visitors WHERE ${visitorFilter(query)}),
    customer_page AS (SELECT * FROM filtered_customers WHERE ${query.tab === 'customers'}
      ORDER BY ${sortSql(query)} LIMIT ${query.size} OFFSET ${query.offset}),
    visitor_page AS (SELECT * FROM filtered_visitors WHERE ${query.tab === 'visitors'}
      ORDER BY ${sortSql(query, true)} LIMIT ${query.size} OFFSET ${query.offset})
    SELECT jsonb_build_object(
      'customers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', "id", 'name', name, 'email', "email", 'phone', "phone", 'createdAt', "createdAt",
        'segment', segment, 'ltv', ltv, 'currency', currency, 'ordersCount', orders_count, 'aov', aov,
        'lastPurchase', last_purchase, 'lastActivity', last_activity, 'cartValue', cart_value,
        'cartCount', cart_count, 'abandoned', abandoned, 'risk', risk, 'quality', quality,
        'activitySummary', activity_summary) ORDER BY ${sortSql(query)}) FROM customer_page), '[]'::jsonb),
      'visitors', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', "id", 'createdAt', "createdAt", 'lastActivity', last_activity, 'sessionsCount', sessions_count,
        'eventsCount', events_count, 'currency', 'CLP', 'cartValue', cart_value, 'cartCount', cart_count,
        'abandoned', abandoned, 'activitySummary', activity_summary) ORDER BY ${sortSql(query, true)}) FROM visitor_page), '[]'::jsonb),
      'totalCustomers', (SELECT count(*) FROM customers), 'totalVisitors', (SELECT count(*) FROM visitors),
      'filteredTotal', CASE WHEN ${query.tab === 'customers'} THEN (SELECT count(*) FROM filtered_customers) ELSE (SELECT count(*) FROM filtered_visitors) END,
      'kpis', (SELECT jsonb_build_object('total', count(*),
        'new30', count(*) FILTER (WHERE "createdAt" >= CURRENT_TIMESTAMP - interval '30 days'),
        'repeat', count(*) FILTER (WHERE orders_count >= 2), 'activeCarts', count(*) FILTER (WHERE cart_count > 0),
        'atRisk', count(*) FILTER (WHERE risk = 'high')) FROM customers)
    ) AS page`;
}

export async function getCustomerListPage(input: CustomerListQuery, database?: ReadDatabase): Promise<CustomerListPage> {
  const reader = database ?? (await import('@jssprz/ludo2go-database')).prisma;
  const [result] = await reader.$queryRaw<Array<{ page: CustomerListPage }>>(buildCustomerListSql(input));
  if (!result) throw new Error('customerListUnavailable');
  return result.page;
}

export function buildCustomerDuplicateSql(input: CustomerListQuery, customerId?: string, candidateId?: string): Prisma.Sql {
  const query = parseCustomerListQuery(new URLSearchParams(Object.entries(input).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])));
  const search = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`;
  return Prisma.sql`WITH ${identityCtes}, duplicate_keys AS (
    SELECT "id", 'email' AS reason, email_key AS key FROM customer_identity WHERE email_key <> '' AND email_matches > 1
    UNION ALL SELECT "id", 'phone', phone_key FROM customer_identity WHERE length(phone_key) >= 8 AND phone_matches > 1
    UNION ALL SELECT "id", 'name', name_key FROM customer_identity WHERE name_key LIKE '% %' AND name_matches > 1
  ), pairs AS (
    SELECT first."id" AS first_id, second."id" AS second_id, array_agg(first.reason ORDER BY first.reason) AS reasons
    FROM duplicate_keys first JOIN duplicate_keys second ON first.reason = second.reason AND first.key = second.key AND first."id" < second."id"
    WHERE (${customerId ?? null}::text IS NULL OR first."id" = ${customerId ?? null} OR second."id" = ${customerId ?? null})
      AND (${candidateId ?? null}::text IS NULL OR first."id" = ${candidateId ?? null} OR second."id" = ${candidateId ?? null})
    GROUP BY first."id", second."id"
  ), matched AS (
    SELECT pairs.*, first.name AS first_name, first."email" AS first_email, first."phone" AS first_phone,
      second.name AS second_name, second."email" AS second_email, second."phone" AS second_phone
    FROM pairs JOIN customer_identity first ON first."id" = first_id JOIN customer_identity second ON second."id" = second_id
    WHERE ${!query.q} OR first.name ILIKE ${search} OR first."email" ILIKE ${search} OR first."phone" ILIKE ${search}
      OR second.name ILIKE ${search} OR second."email" ILIKE ${search} OR second."phone" ILIKE ${search}
      OR first_id ILIKE ${search} OR second_id ILIKE ${search}
  ), page AS (SELECT * FROM matched ORDER BY first_id, second_id LIMIT ${query.size} OFFSET ${query.offset})
  SELECT jsonb_build_object('total', (SELECT count(*) FROM matched), 'size', ${query.size}::int, 'offset', ${query.offset}::int, 'mergeAllowed', false,
    'candidates', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'customer', jsonb_build_object('id', first_id, 'name', first_name, 'email', first_email, 'phone', first_phone, 'href', '/customers/' || first_id),
      'candidate', jsonb_build_object('id', second_id, 'name', second_name, 'email', second_email, 'phone', second_phone, 'href', '/customers/' || second_id),
      'reasons', reasons) ORDER BY first_id, second_id) FROM page), '[]'::jsonb)) AS page`;
}

export async function getCustomerDuplicateCandidates(input: CustomerListQuery, customerId?: string, candidateId?: string, database?: ReadDatabase): Promise<CustomerDuplicatePage> {
  const reader = database ?? (await import('@jssprz/ludo2go-database')).prisma;
  const [result] = await reader.$queryRaw<Array<{ page: CustomerDuplicatePage }>>(buildCustomerDuplicateSql(input, customerId, candidateId));
  if (!result) throw new Error('customerListUnavailable');
  return result.page;
}

export class CustomerAccessError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

export async function getCustomerDuplicateReview(customerId: string, candidateId: string, database?: ReadDatabase): Promise<CustomerDuplicateReview | null> {
  if (!parseCustomerListReviewIds(new URLSearchParams({ customerId, candidateId }))) return null;
  const result = await getCustomerDuplicateCandidates(parseCustomerListQuery({}), customerId, candidateId, database);
  if (!result.candidates[0]) return null;
  return { candidate: result.candidates[0], mergeAllowed: false, reviewPersisted: false, blockedReason: 'relationshipConflictReviewRequired' };
}

type AdminAccessDependencies = {
  getSession: () => Promise<{ user?: { id?: string } } | null>;
  findAdmin: (id: string) => Promise<{ id: string } | null>;
};

export async function requireCustomerAdmin(dependencies?: AdminAccessDependencies): Promise<void> {
  const session = dependencies ? await dependencies.getSession() : await (await import('../auth')).auth();
  if (!session?.user?.id) throw new CustomerAccessError('unauthorized', 401);
  const admin = dependencies ? await dependencies.findAdmin(session.user.id)
    : await (await import('@jssprz/ludo2go-database')).prisma.adminUser.findUnique({ where: { id: session.user.id }, select: { id: true } });
  if (!admin) throw new CustomerAccessError('forbidden', 403);
}