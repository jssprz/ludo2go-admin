import 'server-only';

import { prisma } from '@jssprz/ludo2go-database';
import { ProductStatus, ProductKind, EventType } from '@prisma/client';

export type SortableProductColumn =
  | 'name'
  | 'bggId'
  | 'status'
  | 'kind'
  | 'brand'
  | 'createdAt'
  | 'updatedAt'
  | 'variants'
  | 'stock'
  | 'views'
  | 'variantSales'
  | 'variantViews'
  | 'variantClicks'
  | 'variantImpressions'
  | 'variantInCarts'
  | 'variantDaysActive'
  | 'variantRating'
  | 'variantReviewRating'
  | 'variantReviews'
  | 'variantBggRank';

export type SortOrder = 'asc' | 'desc';

export interface ProductFilters {
  search?: string;
  status?: ProductStatus;
  kind?: ProductKind;
  brandId?: string;
  tags?: string[];
}

const BESTSELLER_DAYS = 15;
const POPULAR_DAYS = 7;
const PRODUCTS_PER_PAGE = 20;

const getAvgRating = (ratings: number[]) => {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, value) => acc + value, 0);
  return sum / ratings.length;
};

type VariantMetrics = {
  id: string;
  unitsSoldInWindow: number;
  viewCount: number;
  clicks: number;
  impressions: number;
  inCartsQuantity: number;
  daysSinceActivated: number | null;
  rating: number | null;
  bggRating: number | null;
  reviewRating: number;
  reviewCount: number;
  bggRank: number | null;
};

function collectStringValuesByKeys(
  value: unknown,
  keys: Set<string>,
  maxDepth = 5
) {
  const found: string[] = [];

  function walk(node: unknown, depth: number) {
    if (depth > maxDepth || node == null) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }

    if (typeof node !== 'object') return;

    for (const [rawKey, rawValue] of Object.entries(node)) {
      const key = rawKey.toLowerCase();

      if (keys.has(key)) {
        if (typeof rawValue === 'string') {
          const normalized = rawValue.trim();
          if (normalized) found.push(normalized);
        }
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
          found.push(String(rawValue));
        }
        if (Array.isArray(rawValue)) {
          for (const item of rawValue) {
            if (typeof item === 'string' && item.trim()) {
              found.push(item.trim());
            }
            if (typeof item === 'number' && Number.isFinite(item)) {
              found.push(String(item));
            }
          }
        }
      }

      if (rawValue && typeof rawValue === 'object') {
        walk(rawValue, depth + 1);
      }
    }
  }

  walk(value, 0);

  return Array.from(new Set(found));
}

async function enrichProductsWithVariantRelevance<T extends {
  id: string;
  slug: string;
  variants: Array<{
    id: string;
    sku: string;
    firstActivedAt?: Date | null;
    activedAt?: Date | null;
    reviews?: Array<{ rating: number | null }>;
  }>;
  bgg?: {
    boardgameRank: number | null;
    avgRating?: number | null;
  } | null;
}>(products: T[]) {
  if (products.length === 0) return products;

  const now = new Date();
  const bestsellerWindowStart = new Date(now);
  bestsellerWindowStart.setDate(bestsellerWindowStart.getDate() - BESTSELLER_DAYS);

  const popularWindowStart = new Date(now);
  popularWindowStart.setDate(popularWindowStart.getDate() - POPULAR_DAYS);

  const variantIds = new Set<string>();
  const variantIdBySku = new Map<string, string>();
  const variantIdsByProductSlug = new Map<string, string[]>();

  for (const product of products) {
    const slugKey = product.slug.toLowerCase();
    const idsForSlug = variantIdsByProductSlug.get(slugKey) ?? [];

    for (const variant of product.variants) {
      variantIds.add(variant.id);
      variantIdBySku.set(variant.sku.toLowerCase(), variant.id);
      idsForSlug.push(variant.id);
    }

    variantIdsByProductSlug.set(slugKey, idsForSlug);
  }

  if (variantIds.size === 0) {
    return products.map((product) => ({
      ...product,
      topVariantRelevance: null,
    }));
  }

  const [recentOrders, activeCarts, relevanceEvents] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: bestsellerWindowStart },
        status: { not: 'cancelled' as any },
      },
      select: {
        items: {
          select: {
            quantity: true,
            variantId: true,
            variant: { select: { id: true } },
          },
        },
      },
    }),
    prisma.cart.findMany({
      where: { status: 'active' as any },
      select: {
        items: {
          select: {
            quantity: true,
            variantId: true,
            variant: { select: { id: true } },
          },
        },
      },
    }),
    prisma.event.findMany({
      where: {
        eventType: {
          in: [
            'product_view',
            'product_impression',
            'search_result_click',
            'typeahead_result_click',
          ] as any,
        },
        occurredAt: { gte: popularWindowStart },
      },
      select: {
        eventType: true,
        properties: true,
      },
    }),
  ]);

  const unitsSoldInWindow = new Map<string, number>();
  for (const order of recentOrders) {
    for (const item of order.items) {
      const variantId = item.variantId ?? item.variant?.id;
      if (!variantId || !variantIds.has(variantId)) continue;
      unitsSoldInWindow.set(
        variantId,
        (unitsSoldInWindow.get(variantId) ?? 0) + Math.max(0, item.quantity)
      );
    }
  }

  const inCartsQuantity = new Map<string, number>();
  for (const cart of activeCarts) {
    for (const item of cart.items) {
      const variantId = item.variantId ?? item.variant?.id;
      if (!variantId || !variantIds.has(variantId)) continue;
      inCartsQuantity.set(
        variantId,
        (inCartsQuantity.get(variantId) ?? 0) + Math.max(0, item.quantity)
      );
    }
  }

  const viewCount = new Map<string, number>();
  const clicks = new Map<string, number>();
  const impressions = new Map<string, number>();

  const variantIdKeys = new Set([
    'variantid',
    'productvariantid',
    'selectedvariantid',
    'id',
  ]);
  const skuKeys = new Set([
    'sku',
    'variantsku',
    'selectedvariantsku',
  ]);
  const productSlugKeys = new Set([
    'productslug',
    'slug',
    'productid',
    'selectedproductslug',
  ]);

  function incrementMap(map: Map<string, number>, variantId: string, amount = 1) {
    map.set(variantId, (map.get(variantId) ?? 0) + amount);
  }

  function incrementByProductSlug(map: Map<string, number>, slug: string, amount = 1) {
    const ids = variantIdsByProductSlug.get(slug.toLowerCase());
    if (!ids || ids.length === 0) return false;
    const apportioned = amount / ids.length;
    for (const id of ids) incrementMap(map, id, apportioned);
    return true;
  }

  function extractImpressionVariantSkus(properties: unknown): string[] {
    if (!properties || typeof properties !== 'object') return [];

    const direct = (properties as { variantSku?: unknown }).variantSku;
    const values: string[] = [];

    if (typeof direct === 'string' && direct.trim()) {
      values.push(direct.trim());
    }

    if (Array.isArray(direct)) {
      for (const entry of direct) {
        if (typeof entry === 'string' && entry.trim()) {
          values.push(entry.trim());
        }
      }
    }

    if (values.length > 0) {
      return values.map((sku) => sku.toLowerCase());
    }

    return collectStringValuesByKeys(properties, new Set(['variantsku']))
      .map((sku) => sku.toLowerCase());
  }

  function extractClickVariantSkus(properties: unknown): string[] {
    if (!properties || typeof properties !== 'object') return [];

    const direct = (properties as { variantSku?: unknown }).variantSku;
    const values: string[] = [];

    if (typeof direct === 'string' && direct.trim()) {
      values.push(direct.trim());
    }

    if (Array.isArray(direct)) {
      for (const entry of direct) {
        if (typeof entry === 'string' && entry.trim()) {
          values.push(entry.trim());
        }
      }
    }

    if (values.length > 0) {
      return values.map((sku) => sku.toLowerCase());
    }

    return collectStringValuesByKeys(properties, new Set(['variantsku']))
      .map((sku) => sku.toLowerCase());
  }

  for (const event of relevanceEvents) {
    if (event.eventType === 'product_impression') {
      const impressionSkus = extractImpressionVariantSkus(event.properties);
      const resolvedImpressionVariantIds = impressionSkus
        .map((sku) => variantIdBySku.get(sku))
        .filter((id): id is string => !!id);

      if (resolvedImpressionVariantIds.length > 0) {
        for (const id of resolvedImpressionVariantIds) {
          incrementMap(impressions, id, 1);
        }
        continue;
      }
    }

    if (event.eventType === 'search_result_click' || event.eventType === 'typeahead_result_click') {
      const clickSkus = extractClickVariantSkus(event.properties);
      const resolvedClickVariantIds = clickSkus
        .map((sku) => variantIdBySku.get(sku))
        .filter((id): id is string => !!id);

      if (resolvedClickVariantIds.length > 0) {
        for (const id of resolvedClickVariantIds) {
          incrementMap(clicks, id, 1);
        }
        continue;
      }
    }

    const foundVariantIds = collectStringValuesByKeys(event.properties, variantIdKeys)
      .filter((id) => variantIds.has(id));
    const foundSkus = collectStringValuesByKeys(event.properties, skuKeys)
      .map((sku) => sku.toLowerCase());
    const foundProductSlugs = collectStringValuesByKeys(event.properties, productSlugKeys)
      .map((slug) => slug.toLowerCase());

    const resolvedVariantIds = new Set<string>();
    for (const id of foundVariantIds) resolvedVariantIds.add(id);
    for (const sku of foundSkus) {
      const bySku = variantIdBySku.get(sku);
      if (bySku) resolvedVariantIds.add(bySku);
    }

    const targetMap =
      event.eventType === 'product_view'
        ? viewCount
        : event.eventType === 'product_impression'
        ? impressions
        : clicks;

    if (resolvedVariantIds.size > 0) {
      for (const id of Array.from(resolvedVariantIds)) {
        incrementMap(targetMap, id, 1);
      }
      continue;
    }

    for (const slug of foundProductSlugs) {
      incrementByProductSlug(targetMap, slug, 1);
    }
  }

  const variantMetricsById = new Map<string, VariantMetrics>();

  for (const product of products) {
    for (const variant of product.variants) {
      const variantReviewRatings = (variant.reviews ?? [])
        .map((review) => review.rating)
        .filter((rating): rating is number => typeof rating === 'number' && Number.isFinite(rating));
      const reviewRating = variantReviewRatings.length > 0 ? getAvgRating(variantReviewRatings) : 0;

      const activationDate = variant.firstActivedAt ?? variant.activedAt;
      const daysSinceActivated = activationDate
        ? Math.max(
            0,
            Math.floor((now.getTime() - new Date(activationDate).getTime()) / 86_400_000)
          )
        : null;

      const entry: VariantMetrics = {
        id: variant.id,
        unitsSoldInWindow: unitsSoldInWindow.get(variant.id) ?? 0,
        viewCount: viewCount.get(variant.id) ?? 0,
        clicks: clicks.get(variant.id) ?? 0,
        impressions: impressions.get(variant.id) ?? 0,
        inCartsQuantity: inCartsQuantity.get(variant.id) ?? 0,
        daysSinceActivated,
        rating: reviewRating,
        bggRating: product.bgg?.avgRating ?? null,
        reviewRating,
        reviewCount: variantReviewRatings.length,
        bggRank: product.bgg?.boardgameRank ?? null,
      };

      variantMetricsById.set(variant.id, entry);
    }
  }

  return products.map((product) => {
    let topVariantRelevance: {
      variantId: string;
      sku: string;
      unitsSoldInWindow: number;
      viewCount: number;
      clicks: number;
      impressions: number;
      inCartsQuantity: number;
      daysSinceActivated: number | null;
      rating: number | null;
      bggRating: number | null;
      reviewCount: number;
      reviewRating: number;
      bggRank: number | null;
    } | null = null;

    for (const variant of product.variants) {
      const metric = variantMetricsById.get(variant.id);
      if (!metric) continue;

      const candidate = {
        variantId: variant.id,
        sku: variant.sku,
        unitsSoldInWindow: metric.unitsSoldInWindow,
        viewCount: metric.viewCount,
        clicks: metric.clicks,
        impressions: metric.impressions,
        inCartsQuantity: metric.inCartsQuantity,
        daysSinceActivated: metric.daysSinceActivated,
        rating: metric.rating,
        bggRating: metric.bggRating,
        reviewRating: metric.reviewRating,
        reviewCount: metric.reviewCount,
        bggRank: metric.bggRank,
      };

      if (
        !topVariantRelevance ||
        candidate.unitsSoldInWindow > topVariantRelevance.unitsSoldInWindow ||
        (candidate.unitsSoldInWindow === topVariantRelevance.unitsSoldInWindow &&
          candidate.viewCount > topVariantRelevance.viewCount) ||
        (candidate.unitsSoldInWindow === topVariantRelevance.unitsSoldInWindow &&
          candidate.viewCount === topVariantRelevance.viewCount &&
          candidate.clicks > topVariantRelevance.clicks)
      ) {
        topVariantRelevance = candidate;
      }
    }

    return {
      ...product,
      topVariantRelevance,
    };
  });
}

export async function getProducts(
  search: string,
  offset: number,
  status: ProductStatus | undefined,
  sortBy: SortableProductColumn = 'createdAt',
  sortOrder: SortOrder = 'desc',
  filters?: { kind?: ProductKind; brandId?: string; tags?: string[] }
) {
  const where: any = {};

  if (search) {
    const orConditions: any[] = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];

    // If the search term is a pure integer, also match on bggId and bgg.id
    const parsed = parseInt(search, 10);
    if (!isNaN(parsed) && String(parsed) === search.trim()) {
      orConditions.push({ bggId: { equals: parsed } });
      orConditions.push({ bgg: { id: { equals: parsed } } });
    }

    where.OR = orConditions;
  }

  if (status) {
    where.status = status;
  }

  if (filters?.kind) {
    where.kind = filters.kind;
  }

  if (filters?.brandId) {
    where.brandId = filters.brandId;
  }

  if (filters?.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }

  const includeProductRelations = {
    brand: true,
    bgg: { select: { id: true, boardgameRank: true, avgRating: true } },
    mediaLinks: {
      orderBy: { sort: 'asc' },
      include: {
        media: true
      }
    },
    variants: { include: { inventory: true, reviews: { select: { rating: true } } } },
    createdByAdminUser: { select: { id: true, username: true, firstName: true, lastName: true } },
    updatedByAdminUser: { select: { id: true, username: true, firstName: true, lastName: true } },
  } as const;

  let totalProducts = await prisma.product.count({ where });
  // Event/relevance-based sorting requires enriching products before pagination.
  if (
    sortBy === 'views' ||
    sortBy === 'variantSales' ||
    sortBy === 'variantViews' ||
    sortBy === 'variantClicks' ||
    sortBy === 'variantImpressions' ||
    sortBy === 'variantInCarts' ||
    sortBy === 'variantDaysActive' ||
    sortBy === 'variantRating' ||
    sortBy === 'variantReviewRating' ||
    sortBy === 'variantReviews' ||
    sortBy === 'variantBggRank'
  ) {
    const allProducts = await prisma.product.findMany({
      include: includeProductRelations,
      where,
    });

    const productSlugs = allProducts.map((product) => product.slug);
    const slugSet = new Set(productSlugs);

    const productViewEvents = productSlugs.length
      ? await Promise.all([
          prisma.event.findMany({
            where: { eventType: EventType.product_view },
            select: { properties: true },
          }),
        ]).then(([events]) => events)
      : [];

    const viewsBySlug = new Map<string, number>();
    for (const event of productViewEvents) {
      if (!event.properties || typeof event.properties !== 'object') continue;
      const productSlug = (event.properties as { productSlug?: unknown }).productSlug;
      if (typeof productSlug !== 'string') continue;
      if (!slugSet.has(productSlug)) continue;
      viewsBySlug.set(productSlug, (viewsBySlug.get(productSlug) ?? 0) + 1);
    }

    const productsWithViews = allProducts
      .map((product) => ({
        ...product,
        productViews: Number(viewsBySlug.get(product.slug) ?? 0),
      }));

    const enrichedProducts = await enrichProductsWithVariantRelevance(productsWithViews);

    const sortedProducts = enrichedProducts.sort((a: any, b: any) => {
        const leftRelevance = a.topVariantRelevance;
        const rightRelevance = b.topVariantRelevance;

        const resolveVariantMetric = () => {
          switch (sortBy) {
            case 'variantSales':
              return {
                left: leftRelevance?.unitsSoldInWindow ?? 0,
                right: rightRelevance?.unitsSoldInWindow ?? 0,
              };
            case 'variantViews':
              return {
                left: leftRelevance?.viewCount ?? 0,
                right: rightRelevance?.viewCount ?? 0,
              };
            case 'variantClicks':
              return {
                left: leftRelevance?.clicks ?? 0,
                right: rightRelevance?.clicks ?? 0,
              };
            case 'variantImpressions':
              return {
                left: leftRelevance?.impressions ?? 0,
                right: rightRelevance?.impressions ?? 0,
              };
            case 'variantInCarts':
              return {
                left: leftRelevance?.inCartsQuantity ?? 0,
                right: rightRelevance?.inCartsQuantity ?? 0,
              };
            case 'variantDaysActive':
              return {
                left: leftRelevance?.daysSinceActivated ?? Number.MAX_SAFE_INTEGER,
                right: rightRelevance?.daysSinceActivated ?? Number.MAX_SAFE_INTEGER,
              };
            case 'variantRating':
              return {
                left: leftRelevance?.bggRating ?? 0,
                right: rightRelevance?.bggRating ?? 0,
              };
            case 'variantReviewRating':
              return {
                left: leftRelevance?.reviewRating ?? 0,
                right: rightRelevance?.reviewRating ?? 0,
              };
            case 'variantReviews':
              return {
                left: leftRelevance?.reviewCount ?? 0,
                right: rightRelevance?.reviewCount ?? 0,
              };
            case 'variantBggRank':
              return {
                left: leftRelevance?.bggRank ?? Number.MAX_SAFE_INTEGER,
                right: rightRelevance?.bggRank ?? Number.MAX_SAFE_INTEGER,
              };
            default:
              return null;
          }
        };

        const variantMetric = resolveVariantMetric();
        if (variantMetric) {
          const { left, right } = variantMetric;

          if (left === right) {
            return b.createdAt.getTime() - a.createdAt.getTime();
          }

          return sortOrder === 'asc' ? left - right : right - left;
        }

        const left = Number(a.productViews);
        const right = Number(b.productViews);

        if (left === right) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return sortOrder === 'asc'
          ? left - right
          : right - left;
      });

    const pagedProducts = sortedProducts.slice(offset, offset + PRODUCTS_PER_PAGE);
    const newOffset = offset + pagedProducts.length;

    return {
      products: pagedProducts,
      newOffset,
      totalProducts,
    };
  }

  // Build orderBy – some columns map to relations / aggregates
  let orderBy: any;
  if (sortBy === 'variants') {
    orderBy = { variants: { _count: sortOrder } };
  } else if (sortBy === 'stock') {
    // Stock is a sum of variant stock – fall back to createdAt for DB ordering
    // (we can't easily sort by aggregate sum in Prisma without raw SQL)
    orderBy = { createdAt: sortOrder };
  } else if (sortBy === 'bggId') {
    orderBy = { bgg: { id: sortOrder } };
  } else if (sortBy === 'brand') {
    orderBy = { brand: { name: sortOrder } };
  } else {
    orderBy = { [sortBy]: sortOrder };
  }

  const moreProducts = await prisma.product.findMany({
    include: includeProductRelations,
    where,
    take: PRODUCTS_PER_PAGE,
    skip: offset,
    orderBy
  });

  const productSlugs = moreProducts.map((product) => product.slug);
  const slugSet = new Set(productSlugs);

  const productViewEvents = productSlugs.length
    ? await Promise.all([
        prisma.event.findMany({
          where: { eventType: EventType.product_view },
          select: { properties: true },
        }),
      ]).then(([events]) => events)
    : [];

  const viewsBySlug = new Map<string, number>();
  for (const event of productViewEvents) {
    if (!event.properties || typeof event.properties !== 'object') continue;
    const productSlug = (event.properties as { productSlug?: unknown }).productSlug;
    if (typeof productSlug !== 'string') continue;
    if (!slugSet.has(productSlug)) continue;
    viewsBySlug.set(productSlug, (viewsBySlug.get(productSlug) ?? 0) + 1);
  }

  const productsWithViews = moreProducts.map((product) => ({
    ...product,
    productViews: Number(viewsBySlug.get(product.slug) ?? 0),
  }));

  const enrichedProducts = await enrichProductsWithVariantRelevance(productsWithViews);

  const newOffset = moreProducts.length + offset;

  return {
    products: enrichedProducts,
    newOffset,
    totalProducts
  };
}

export async function deleteProductById(id: string) {
  await prisma.product.deleteMany({ where: { id: { equals: id } } })
}

export async function updateProduct(product: any) {
  return await prisma.product.update({
    where: { id: product.id },
    data: product
  })
}

export async function getAllBrands() {
  return prisma.brand.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
}