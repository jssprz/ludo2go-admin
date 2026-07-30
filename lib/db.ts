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
  | 'viewsLast7d'
  | 'variantSales'
  | 'variantViews'
  | 'variantClicks'
  | 'variantImpressions'
  | 'variantInCarts'
  | 'variantDaysActive'
  | 'variantRating'
  | 'variantReviews'
  | 'variantBggRank'
  | 'variantRelevance';

export type SortOrder = 'asc' | 'desc';

export interface ProductFilters {
  search?: string;
  status?: ProductStatus;
  kind?: ProductKind;
  brandId?: string;
  tags?: string[];
}

const RELEVANCE_WINDOW_DAYS = 90;
const PRODUCTS_PER_PAGE = 20;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const percentile95 = (values: number[]) => {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.95)] ?? 0;
};

const normalizeLog = (value: number, p95: number) => {
  if (value <= 0 || p95 <= 0) return 0;

  return clamp01(
    Math.log1p(value) / Math.log1p(p95)
  );
};

const smoothedRate = (
  successes: number,
  opportunities: number,
  priorRate: number,
  priorStrength: number
) => {
  return (
    (successes + priorRate * priorStrength) /
    (opportunities + priorStrength)
  );
};

type VariantRelevanceInput = {
  id: string;
  unitsSoldInWindow: number;
  viewCount: number;
  clicks: number;
  impressions: number;
  inCartsQuantity: number;
  daysSinceActivated: number | null;
  rating: number | null;
  reviewCount: number;
  product?: {
    bgg?: {
      boardgameRank: number | null;
    } | null;
  } | null;
};

function scoreByRelevance<T extends VariantRelevanceInput>(items: T[]): Map<string, number> {
  if (items.length <= 1) {
    return new Map(items.map((item) => [item.id, 1]));
  }

  const metrics = items.map((item, originalIndex) => ({
    item,
    originalIndex,
    sales: Math.max(item.unitsSoldInWindow ?? 0, 0),
    views: Math.max(item.viewCount ?? 0, 0),
    clicks: Math.max(item.clicks ?? 0, 0),
    impressions: Math.max(item.impressions ?? 0, 0),
    carts: Math.max(item.inCartsQuantity ?? 0, 0),
    daysSinceActivated: item.daysSinceActivated,
    rating: item.rating ?? 0,
    reviewCount: Math.max(item.reviewCount ?? 0, 0),
    bggRank: item.product?.bgg?.boardgameRank ?? null,
  }));

  const totals = metrics.reduce(
    (acc, metric) => {
      acc.sales += metric.sales;
      acc.views += metric.views;
      acc.clicks += metric.clicks;
      acc.impressions += metric.impressions;
      acc.carts += metric.carts;
      return acc;
    },
    {
      sales: 0,
      views: 0,
      clicks: 0,
      impressions: 0,
      carts: 0,
    }
  );

  const purchasePrior =
    totals.views > 0 ? totals.sales / totals.views : 0;

  const cartPrior =
    totals.views > 0 ? totals.carts / totals.views : 0;

  const clickPrior =
    totals.impressions > 0
      ? totals.clicks / totals.impressions
      : 0;

  const purchaseRates = metrics.map((metric) =>
    smoothedRate(metric.sales, metric.views, purchasePrior, 100)
  );

  const cartRates = metrics.map((metric) =>
    smoothedRate(metric.carts, metric.views, cartPrior, 100)
  );

  const clickRates = metrics.map((metric) =>
    smoothedRate(
      metric.clicks,
      metric.impressions,
      clickPrior,
      500
    )
  );

  const salesP95 = percentile95(metrics.map((metric) => metric.sales));
  const viewsP95 = percentile95(metrics.map((metric) => metric.views));
  const purchaseRateP95 = percentile95(purchaseRates);
  const cartRateP95 = percentile95(cartRates);
  const clickRateP95 = percentile95(clickRates);

  const totalReviews = metrics.reduce(
    (sum, metric) => sum + metric.reviewCount,
    0
  );

  const averageRating =
    totalReviews > 0
      ? metrics.reduce(
          (sum, metric) =>
            sum + metric.rating * metric.reviewCount,
          0
        ) / totalReviews
      : 4;

  const ranked = metrics.map((metric, index) => {
    const purchaseRate = purchaseRates[index];
    const cartRate = cartRates[index];
    const clickRate = clickRates[index];

    const bayesianRating =
      (
        metric.rating * metric.reviewCount +
        averageRating * 10
      ) /
      (metric.reviewCount + 10);

    const ratingScore =
      metric.rating > 0
        ? clamp01((bayesianRating - 1) / 4)
        : 0;

    const freshnessScore =
      metric.daysSinceActivated == null
        ? 0
        : Math.exp(
            -Math.max(metric.daysSinceActivated, 0) / 60
          );

    const bggScore =
      metric.bggRank != null && metric.bggRank > 0
        ? clamp01(
            1 -
              Math.log(metric.bggRank) /
                Math.log(10_000)
          )
        : 0;

    const score =
      normalizeLog(metric.sales, salesP95) * 0.32 +
      normalizeLog(purchaseRate, purchaseRateP95) * 0.20 +
      normalizeLog(cartRate, cartRateP95) * 0.14 +
      normalizeLog(clickRate, clickRateP95) * 0.08 +
      ratingScore * 0.10 +
      normalizeLog(metric.views, viewsP95) * 0.05 +
      freshnessScore * 0.07 +
      bggScore * 0.04;

    return {
      ...metric,
      score,
    };
  });

  const ordered = ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.sales - a.sales ||
      b.reviewCount - a.reviewCount ||
      a.originalIndex - b.originalIndex
  );

  return new Map(ordered.map((entry) => [entry.item.id, entry.score]));
}

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
  }>;
  bgg?: {
    boardgameRank: number | null;
    avgRating?: number | null;
  } | null;
}>(products: T[]) {
  if (products.length === 0) return products;

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - RELEVANCE_WINDOW_DAYS);

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
        createdAt: { gte: windowStart },
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
        occurredAt: { gte: windowStart },
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

  for (const event of relevanceEvents) {
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

  const relevanceInput: VariantRelevanceInput[] = [];
  const relevanceInputByVariantId = new Map<string, VariantRelevanceInput>();

  for (const product of products) {
    for (const variant of product.variants) {
      const activationDate = variant.firstActivedAt ?? variant.activedAt;
      const daysSinceActivated = activationDate
        ? Math.max(
            0,
            Math.floor((now.getTime() - new Date(activationDate).getTime()) / 86_400_000)
          )
        : null;

      const entry: VariantRelevanceInput = {
        id: variant.id,
        unitsSoldInWindow: unitsSoldInWindow.get(variant.id) ?? 0,
        viewCount: viewCount.get(variant.id) ?? 0,
        clicks: clicks.get(variant.id) ?? 0,
        impressions: impressions.get(variant.id) ?? 0,
        inCartsQuantity: inCartsQuantity.get(variant.id) ?? 0,
        daysSinceActivated,
        rating: product.bgg?.avgRating ?? null,
        reviewCount: 0,
        product: {
          bgg: {
            boardgameRank: product.bgg?.boardgameRank ?? null,
          },
        },
      };

      relevanceInput.push(entry);
      relevanceInputByVariantId.set(variant.id, entry);
    }
  }

  const relevanceScores = scoreByRelevance(relevanceInput);

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
      reviewCount: number;
      bggRank: number | null;
      relevanceScore: number;
    } | null = null;

    for (const variant of product.variants) {
      const metric = relevanceInputByVariantId.get(variant.id);
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
        reviewCount: metric.reviewCount,
        bggRank: metric.product?.bgg?.boardgameRank ?? null,
        relevanceScore: relevanceScores.get(variant.id) ?? 0,
      };

      if (!topVariantRelevance || candidate.relevanceScore > topVariantRelevance.relevanceScore) {
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
    variants: { include: { inventory: true } },
    createdByAdminUser: { select: { id: true, username: true, firstName: true, lastName: true } },
    updatedByAdminUser: { select: { id: true, username: true, firstName: true, lastName: true } },
  } as const;

  let totalProducts = await prisma.product.count({ where });
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Event/relevance-based sorting requires enriching products before pagination.
  if (
    sortBy === 'views' ||
    sortBy === 'viewsLast7d' ||
    sortBy === 'variantSales' ||
    sortBy === 'variantViews' ||
    sortBy === 'variantClicks' ||
    sortBy === 'variantImpressions' ||
    sortBy === 'variantInCarts' ||
    sortBy === 'variantDaysActive' ||
    sortBy === 'variantRating' ||
    sortBy === 'variantReviews' ||
    sortBy === 'variantBggRank' ||
    sortBy === 'variantRelevance'
  ) {
    const allProducts = await prisma.product.findMany({
      include: includeProductRelations,
      where,
    });

    const productSlugs = allProducts.map((product) => product.slug);
    const slugSet = new Set(productSlugs);

    const [productViewEvents, productViewEventsLast7d] = productSlugs.length
      ? await Promise.all([
          prisma.event.findMany({
            where: { eventType: EventType.product_view },
            select: { properties: true },
          }),
          prisma.event.findMany({
            where: { eventType: EventType.product_view, occurredAt: { gte: sevenDaysAgo } },
            select: { properties: true },
          }),
        ])
      : [[], []];

    const viewsBySlug = new Map<string, number>();
    const viewsLast7dBySlug = new Map<string, number>();
    for (const event of productViewEvents) {
      if (!event.properties || typeof event.properties !== 'object') continue;
      const productSlug = (event.properties as { productSlug?: unknown }).productSlug;
      if (typeof productSlug !== 'string') continue;
      if (!slugSet.has(productSlug)) continue;
      viewsBySlug.set(productSlug, (viewsBySlug.get(productSlug) ?? 0) + 1);
    }

    for (const event of productViewEventsLast7d) {
      if (!event.properties || typeof event.properties !== 'object') continue;
      const productSlug = (event.properties as { productSlug?: unknown }).productSlug;
      if (typeof productSlug !== 'string') continue;
      if (!slugSet.has(productSlug)) continue;
      viewsLast7dBySlug.set(productSlug, (viewsLast7dBySlug.get(productSlug) ?? 0) + 1);
    }

    const productsWithViews = allProducts
      .map((product) => ({
        ...product,
        productViews: Number(viewsBySlug.get(product.slug) ?? 0),
        productViewsLast7d: Number(viewsLast7dBySlug.get(product.slug) ?? 0),
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
                left: leftRelevance?.rating ?? 0,
                right: rightRelevance?.rating ?? 0,
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

        if (sortBy === 'variantRelevance') {
          const left = a.topVariantRelevance?.relevanceScore ?? 0;
          const right = b.topVariantRelevance?.relevanceScore ?? 0;

          if (left === right) {
            return b.createdAt.getTime() - a.createdAt.getTime();
          }
          return sortOrder === 'asc' ? left - right : right - left;
        }

        const left = Number(sortBy === 'viewsLast7d' ? a.productViewsLast7d : a.productViews);
        const right = Number(sortBy === 'viewsLast7d' ? b.productViewsLast7d : b.productViews);

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

  const [productViewEvents, productViewEventsLast7d] = productSlugs.length
    ? await Promise.all([
        prisma.event.findMany({
          where: { eventType: EventType.product_view },
          select: { properties: true },
        }),
        prisma.event.findMany({
          where: { eventType: EventType.product_view, occurredAt: { gte: sevenDaysAgo } },
          select: { properties: true },
        }),
      ])
    : [[], []];

  const viewsBySlug = new Map<string, number>();
  const viewsLast7dBySlug = new Map<string, number>();
  for (const event of productViewEvents) {
    if (!event.properties || typeof event.properties !== 'object') continue;
    const productSlug = (event.properties as { productSlug?: unknown }).productSlug;
    if (typeof productSlug !== 'string') continue;
    if (!slugSet.has(productSlug)) continue;
    viewsBySlug.set(productSlug, (viewsBySlug.get(productSlug) ?? 0) + 1);
  }

  for (const event of productViewEventsLast7d) {
    if (!event.properties || typeof event.properties !== 'object') continue;
    const productSlug = (event.properties as { productSlug?: unknown }).productSlug;
    if (typeof productSlug !== 'string') continue;
    if (!slugSet.has(productSlug)) continue;
    viewsLast7dBySlug.set(productSlug, (viewsLast7dBySlug.get(productSlug) ?? 0) + 1);
  }

  const productsWithViews = moreProducts.map((product) => ({
    ...product,
    productViews: Number(viewsBySlug.get(product.slug) ?? 0),
    productViewsLast7d: Number(viewsLast7dBySlug.get(product.slug) ?? 0),
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