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
  | 'views';

export type SortOrder = 'asc' | 'desc';

export interface ProductFilters {
  search?: string;
  status?: ProductStatus;
  kind?: ProductKind;
  brandId?: string;
  tags?: string[];
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
    bgg: { select: { id: true } },
    mediaLinks: {
      include: {
        media: true
      }
    },
    variants: { include: { inventory: true } },
    createdByAdminUser: { select: { id: true, username: true, firstName: true, lastName: true } },
    updatedByAdminUser: { select: { id: true, username: true, firstName: true, lastName: true } },
  } as const;

  let totalProducts = await prisma.product.count({ where });

  // Views sorting requires enriching products with event counts before pagination.
  if (sortBy === 'views') {
    const allProducts = await prisma.product.findMany({
      include: includeProductRelations,
      where,
    });

    const productSlugs = allProducts.map((product) => product.slug);
    const slugSet = new Set(productSlugs);

    const productViewEvents = productSlugs.length
      ? await prisma.event.findMany({
          where: { eventType: EventType.product_view },
          select: { properties: true },
        })
      : [];

    const viewsBySlug = new Map<string, number>();
    for (const event of productViewEvents) {
      if (!event.properties || typeof event.properties !== 'object') continue;
      const productSlug = (event.properties as { productSlug?: unknown }).productSlug;
      if (typeof productSlug !== 'string') continue;
      if (!slugSet.has(productSlug)) continue;
      viewsBySlug.set(productSlug, (viewsBySlug.get(productSlug) ?? 0) + 1);
    }

    const sortedProducts = allProducts
      .map((product) => ({
        ...product,
        productViews: viewsBySlug.get(product.slug) ?? 0,
      }))
      .sort((a, b) => {
        if (a.productViews === b.productViews) {
          return b.createdAt.getTime() - a.createdAt.getTime();
        }
        return sortOrder === 'asc'
          ? a.productViews - b.productViews
          : b.productViews - a.productViews;
      });

    const pagedProducts = sortedProducts.slice(offset, offset + 10);
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
    take: 10,
    skip: offset,
    orderBy
  });

  const productSlugs = moreProducts.map((product) => product.slug);
  const slugSet = new Set(productSlugs);

  const productViewEvents = productSlugs.length
    ? await prisma.event.findMany({
        where: { eventType: EventType.product_view },
        select: { properties: true },
      })
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
    productViews: viewsBySlug.get(product.slug) ?? 0,
  }));

  const newOffset = moreProducts.length + offset;

  return {
    products: productsWithViews,
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