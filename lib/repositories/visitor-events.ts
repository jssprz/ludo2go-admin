import 'server-only';
import { Prisma } from '@prisma/client';
import { profileEventReference } from '../customer-profile-events';
import type { VisitorEventDetails } from '../visitor-events';
import {
  parseVisitorEventsQuery,
  parseVisitorGuestCheckoutProperties
} from '../visitor-events';

type ReadDatabase = {
  $queryRaw<Result = unknown>(query: Prisma.Sql): Promise<Result>;
};

type RawVisitorEventDetails = {
  events: VisitorEventDetails['events'];
  recentEvents: Array<{
    id: string;
    eventType: string;
    occurredAt: string;
    sessionId: string;
    pagePath: string | null;
    properties: unknown;
    resolvedName: string | null;
  }>;
  guestCheckouts: Array<{
    id: string;
    occurredAt: string;
    properties: unknown;
  }>;
};

export function buildVisitorEventDetailsSql(id: string): Prisma.Sql {
  return Prisma.sql`WITH target AS (
    SELECT v."id" FROM "Visitor" v
    WHERE v."id" = ${id} AND NOT EXISTS (
      SELECT 1 FROM "Session" s JOIN "Event" e ON e."sessionId" = s."id"
      WHERE s."visitorId" = v."id" AND e."customerId" IS NOT NULL
    )
  ), event_counts AS (
    SELECT e."eventType"::text AS type, count(*)::int AS count
    FROM target JOIN "Session" s ON s."visitorId" = target."id"
    JOIN "Event" e ON e."sessionId" = s."id"
    GROUP BY e."eventType"::text
  ), recent_candidates AS (
    SELECT e."id", e."eventType", e."occurredAt", e."sessionId", e."pagePath", e.properties
    FROM target JOIN "Session" s ON s."visitorId" = target."id"
    JOIN "Event" e ON e."sessionId" = s."id"
    ORDER BY e."occurredAt" DESC, e."id" ASC LIMIT 301
  ), recent_resolved AS (
    SELECT recent_candidates.*,
      COALESCE(vp.name || ' (' || variant.sku || ')', product.name) AS "resolvedName"
    FROM recent_candidates
    LEFT JOIN "ProductVariant" variant ON variant.id = recent_candidates.properties->>'variantId'
    LEFT JOIN "Product" vp ON vp.id = variant."productId"
    LEFT JOIN "Product" product ON product.id = recent_candidates.properties->>'productId'
  ), guest_candidates AS (
    SELECT e."id", e."occurredAt", e.properties
    FROM target JOIN "Session" s ON s."visitorId" = target."id"
    JOIN "Event" e ON e."sessionId" = s."id"
    WHERE e."eventType"::text = 'checkout_guest_info_complete'
    ORDER BY e."occurredAt" DESC, e."id" ASC LIMIT 51
  )
  SELECT CASE WHEN EXISTS (SELECT 1 FROM target) THEN jsonb_build_object(
    'events', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'type', type, 'count', count) ORDER BY count DESC, type ASC)
      FROM event_counts), '[]'::jsonb),
    'recentEvents', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', "id", 'eventType', "eventType", 'occurredAt', "occurredAt",
      'sessionId', "sessionId", 'pagePath', "pagePath", 'properties', properties,
      'resolvedName', "resolvedName")
      ORDER BY "occurredAt" DESC, "id" ASC) FROM recent_resolved), '[]'::jsonb),
    'guestCheckouts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', "id", 'occurredAt', "occurredAt", 'properties', properties)
      ORDER BY "occurredAt" DESC, "id" ASC) FROM guest_candidates), '[]'::jsonb)
  ) ELSE NULL END AS details`;
}

export async function getVisitorEventDetails(
  id: string,
  database?: ReadDatabase
): Promise<VisitorEventDetails | null> {
  if (!parseVisitorEventsQuery(new URLSearchParams({ id }))) return null;
  const reader = database ?? (await import('@jssprz/ludo2go-database')).prisma;
  const [result] = await reader.$queryRaw<
    Array<{ details: RawVisitorEventDetails | null }>
  >(buildVisitorEventDetailsSql(id));
  if (!result) throw new Error('visitorEventsUnavailable');
  if (!result.details) return null;
  return {
    events: result.details.events.map((event) => ({
      type: event.type,
      count: event.count
    })),
    recentEvents: result.details.recentEvents.slice(0, 300).map((event) => {
      const reference = event.resolvedName
        ? { kind: 'name', value: event.resolvedName.slice(0, 200) }
        : profileEventReference(event.properties);
      return {
        id: event.id,
        eventType: event.eventType,
        occurredAt: new Date(event.occurredAt).toISOString(),
        sessionId: event.sessionId,
        pagePath: event.pagePath?.split(/[?#]/, 1)[0] || null,
        reference: reference
          ? {
              kind:
                reference.kind === 'search'
                  ? ('search' as const)
                  : ('name' as const),
              value: reference.value
            }
          : null,
        guestInfo:
          event.eventType === 'checkout_guest_info_complete'
            ? parseVisitorGuestCheckoutProperties(event.properties)
            : null
      };
    }),
    hasMoreEvents: result.details.recentEvents.length > 300,
    guestCheckouts: result.details.guestCheckouts.slice(0, 50).map((event) => ({
      id: event.id,
      occurredAt: new Date(event.occurredAt).toISOString(),
      ...parseVisitorGuestCheckoutProperties(event.properties)
    })),
    hasMoreGuestCheckouts: result.details.guestCheckouts.length > 50
  };
}
