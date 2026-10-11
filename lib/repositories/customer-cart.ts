import 'server-only';
import { Prisma } from '@prisma/client';
import type {
  CustomerCartDetails,
  CustomerCartOwnerType
} from '../customer-cart';
import { parseCustomerCartQuery } from '../customer-cart';

type ReadDatabase = {
  $queryRaw<Result = unknown>(query: Prisma.Sql): Promise<Result>;
};

export function buildCustomerCartDetailsSql(
  type: CustomerCartOwnerType,
  id: string
): Prisma.Sql {
  return Prisma.sql`WITH visitor_identity AS (
    SELECT s."visitorId", count(DISTINCT e."customerId") AS identified_count,
      min(e."customerId") AS customer_id
    FROM "Session" s LEFT JOIN "Event" e ON e."sessionId" = s."id"
    WHERE s."visitorId" IN (
      SELECT identified_session."visitorId" FROM "Session" identified_session
      JOIN "Event" identified_event ON identified_event."sessionId" = identified_session."id"
      WHERE ${type} = 'customer' AND identified_event."customerId" = ${id}
      UNION SELECT ${id} WHERE ${type} = 'visitor'
    )
    GROUP BY s."visitorId"
  ), target AS (
    SELECT COALESCE(NULLIF(trim(c."preferredCurrency"), ''), 'CLP') AS currency
    FROM "Customer" c WHERE ${type} = 'customer' AND c."id" = ${id}
    UNION ALL
    SELECT 'CLP' FROM "Visitor" v LEFT JOIN visitor_identity i ON i."visitorId" = v."id"
    WHERE ${type} = 'visitor' AND v."id" = ${id} AND COALESCE(i.identified_count, 0) = 0
  ), cart_candidates AS (
    SELECT cart."id", cart.status::text AS status, cart."updatedAt", target.currency
    FROM "Cart" cart CROSS JOIN target
    LEFT JOIN visitor_identity i ON i."visitorId" = cart."visitorId"
    WHERE cart.status::text IN ('active', 'abandoned')
      AND EXISTS (SELECT 1 FROM "CartItem" item WHERE item."cartId" = cart."id")
      AND ((${type} = 'customer' AND COALESCE(cart."customerId",
          CASE WHEN i.identified_count = 1 THEN i.customer_id END) = ${id})
        OR (${type} = 'visitor' AND cart."visitorId" = ${id} AND cart."customerId" IS NULL))
    ORDER BY cart."updatedAt" DESC, cart."id" ASC LIMIT 201
  ), carts AS (
    SELECT * FROM cart_candidates ORDER BY "updatedAt" DESC, "id" ASC LIMIT 200
  ), item_candidates AS (
    SELECT item."id", item."cartId", item."variantId", item.quantity, item."unitPriceAtAdd", carts.currency,
      row_number() OVER (ORDER BY carts."updatedAt" DESC, carts."id", item."createdAt", item."id") AS position
    FROM carts JOIN "CartItem" item ON item."cartId" = carts."id"
    ORDER BY carts."updatedAt" DESC, carts."id", item."createdAt", item."id" LIMIT 2001
  ), items AS (
    SELECT item."cartId", item.position, jsonb_build_object(
      'id', item."id", 'productId', variant."productId", 'variantId', item."variantId",
      'name', COALESCE(NULLIF(trim(variant."displayTitleLong"), ''),
        NULLIF(trim(variant."displayTitleShort"), ''), NULLIF(trim(product.name), ''), variant.sku),
      'sku', variant.sku, 'quantity', item.quantity,
      'unitPrice', COALESCE(item."unitPriceAtAdd", price.amount), 'imageUrl', image.url) AS details
    FROM item_candidates item
    JOIN "ProductVariant" variant ON variant."id" = item."variantId"
    JOIN "Product" product ON product."id" = variant."productId"
    LEFT JOIN LATERAL (
      SELECT p.amount FROM "Price" p WHERE p."variantId" = item."variantId"
        AND p.currency::text = item.currency AND p.type::text = 'retail' AND p.active
        AND p."priceBookId" IS NULL AND p."channelId" IS NULL AND p.region IS NULL
        AND (p."startsAt" IS NULL OR p."startsAt" <= CURRENT_TIMESTAMP)
        AND (p."endsAt" IS NULL OR p."endsAt" > CURRENT_TIMESTAMP)
      ORDER BY p."createdAt" DESC, p."id" ASC LIMIT 1
    ) price ON true
    LEFT JOIN LATERAL (
      SELECT media.url FROM (
        SELECT link."mediaId", link.role, link.sort, 0 AS source
        FROM "VariantMedia" link WHERE link."variantId" = item."variantId"
        UNION ALL
        SELECT link."mediaId", link.role, link.sort, 1 AS source
        FROM "ProductMedia" link WHERE link."productId" = variant."productId"
      ) link JOIN "MediaAsset" media ON media."id" = link."mediaId"
      WHERE media.kind::text = 'image' AND media.url ~* '^https?://[^[:space:]]+$'
      ORDER BY link.source, CASE WHEN link.role::text = 'primary' THEN 0 ELSE 1 END,
        link.sort ASC NULLS LAST, media."id" ASC LIMIT 1
    ) image ON true
    WHERE item.position <= 2000
  ), cart_details AS (
    SELECT carts."id", carts.status, carts."updatedAt", carts.currency,
      jsonb_agg(items.details ORDER BY items.position) AS items
    FROM carts JOIN items ON items."cartId" = carts."id"
    GROUP BY carts."id", carts.status, carts."updatedAt", carts.currency
  )
  SELECT CASE WHEN EXISTS (SELECT 1 FROM target) THEN jsonb_build_object(
    'carts', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', "id", 'status', status, 'updatedAt', "updatedAt", 'currency', currency, 'items', items)
      ORDER BY "updatedAt" DESC, "id" ASC) FROM cart_details), '[]'::jsonb),
    'hasMore', (SELECT count(*) > 200 FROM cart_candidates)
      OR (SELECT count(*) > 2000 FROM item_candidates)
  ) ELSE NULL END AS details`;
}

function safeImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export async function getCustomerCartDetails(
  type: CustomerCartOwnerType,
  id: string,
  database?: ReadDatabase
): Promise<CustomerCartDetails | null> {
  if (!parseCustomerCartQuery(new URLSearchParams({ type, id }))) return null;
  const reader = database ?? (await import('@jssprz/ludo2go-database')).prisma;
  const [result] = await reader.$queryRaw<
    Array<{ details: CustomerCartDetails | null }>
  >(buildCustomerCartDetailsSql(type, id));
  if (!result) throw new Error('customerCartUnavailable');
  if (!result.details) return null;
  return {
    hasMore: result.details.hasMore,
    carts: result.details.carts.map((cart) => ({
      ...cart,
      updatedAt: new Date(cart.updatedAt).toISOString(),
      items: cart.items.map((item) => ({
        ...item,
        imageUrl: safeImageUrl(item.imageUrl)
      }))
    }))
  };
}
