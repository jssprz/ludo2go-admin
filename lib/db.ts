import 'server-only';

import { prisma } from '@jssprz/ludo2go-database';
import { ProductStatus, ProductKind, EventType } from '@prisma/client';
import { scoreByRelevance } from '@/lib/repositories/variant.repository';

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
  | 'variantReviewRating'
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
  bestsellerDays?: number;
  popularDays?: number;
}

export const DEFAULT_BESTSELLER_DAYS = 15;
export const DEFAULT_POPULAR_DAYS = 7;
const BESTSELLER_DAYS = DEFAULT_BESTSELLER_DAYS;
const POPULAR_DAYS = DEFAULT_POPULAR_DAYS;
const PRODUCTS_PER_PAGE = 20;

const resolveWindowDays = (value: number | undefined, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(365, Math.max(1, Math.floor(value)));
};

const getAvgRating = (ratings: number[]) => {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, value) => acc + value, 0);
  return sum / ratings.length;
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
  bggRating: number | null;
  reviewRating: number;
  reviewCount: number;
  product?: {
    bgg?: {
      boardgameRank: number | null;
    } | null;
  } | null;
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
}>(products: T[], options?: { bestsellerDays?: number; popularDays?: number }) {
  if (products.length === 0) return products;

  const bestsellerDays = resolveWindowDays(options?.bestsellerDays, BESTSELLER_DAYS);
  const popularDays = resolveWindowDays(options?.popularDays, POPULAR_DAYS);

  const now = new Date();
  const bestsellerWindowStart = new Date(now);
  bestsellerWindowStart.setDate(bestsellerWindowStart.getDate() - bestsellerDays);

  const popularWindowStart = new Date(now);
  popularWindowStart.setDate(popularWindowStart.getDate() - popularDays);

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

      const entry: VariantRelevanceInput = {
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

  const productRelevanceInput: VariantRelevanceInput[] = products.map((product) => {
    const metrics = product.variants
      .map((variant) => relevanceInputByVariantId.get(variant.id))
      .filter((metric): metric is VariantRelevanceInput => !!metric);

    const totalReviewCount = metrics.reduce((sum, metric) => sum + metric.reviewCount, 0);
    const reviewWeightedRating =
      totalReviewCount > 0
        ? metrics.reduce((sum, metric) => sum + (metric.reviewRating * metric.reviewCount), 0) / totalReviewCount
        : 0;

    const freshnessCandidates = metrics
      .map((metric) => metric.daysSinceActivated)
      .filter((days): days is number => days != null);

    return {
      id: product.id,
      unitsSoldInWindow: metrics.reduce((sum, metric) => sum + metric.unitsSoldInWindow, 0),
      viewCount: metrics.reduce((sum, metric) => sum + metric.viewCount, 0),
      clicks: metrics.reduce((sum, metric) => sum + metric.clicks, 0),
      impressions: metrics.reduce((sum, metric) => sum + metric.impressions, 0),
      inCartsQuantity: metrics.reduce((sum, metric) => sum + metric.inCartsQuantity, 0),
      daysSinceActivated: freshnessCandidates.length > 0 ? Math.min(...freshnessCandidates) : null,
      rating: reviewWeightedRating,
      bggRating: product.bgg?.avgRating ?? null,
      reviewRating: reviewWeightedRating,
      reviewCount: totalReviewCount,
      product: {
        bgg: {
          boardgameRank: product.bgg?.boardgameRank ?? null,
        },
      },
    };
  });

  const productRelevanceScores = scoreByRelevance(productRelevanceInput);

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
        bggRating: metric.bggRating,
        reviewRating: metric.reviewRating,
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
      productRelevanceScore: productRelevanceScores.get(product.id) ?? 0,
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
  filters?: { kind?: ProductKind; brandId?: string; tags?: string[]; bestsellerDays?: number; popularDays?: number }
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
    sortBy === 'variantReviewRating' ||
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

    const enrichedProducts = await enrichProductsWithVariantRelevance(productsWithViews, {
      bestsellerDays: filters?.bestsellerDays,
      popularDays: filters?.popularDays,
    });

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

        if (sortBy === 'variantRelevance') {
          const left = a.productRelevanceScore ?? 0;
          const right = b.productRelevanceScore ?? 0;

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

  const enrichedProducts = await enrichProductsWithVariantRelevance(productsWithViews, {
    bestsellerDays: filters?.bestsellerDays,
    popularDays: filters?.popularDays,
  });

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