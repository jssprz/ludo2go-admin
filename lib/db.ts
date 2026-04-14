import 'server-only';

import { prisma } from '@jssprz/ludo2go-database';
import { ProductStatus, ProductKind } from '@prisma/client';

export type SortableProductColumn =
  | 'name'
  | 'status'
  | 'kind'
  | 'createdAt'
  | 'updatedAt'
  | 'variants'
  | 'stock';

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

    // If the search term is a pure integer, also match on bggId
    const parsed = parseInt(search, 10);
    if (!isNaN(parsed) && String(parsed) === search.trim()) {
      orConditions.push({ bggId: { equals: parsed } });
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

  // Build orderBy – some columns map to relations / aggregates
  let orderBy: any;
  if (sortBy === 'variants') {
    orderBy = { variants: { _count: sortOrder } };
  } else if (sortBy === 'stock') {
    // Stock is a sum of variant stock – fall back to createdAt for DB ordering
    // (we can't easily sort by aggregate sum in Prisma without raw SQL)
    orderBy = { createdAt: sortOrder };
  } else {
    orderBy = { [sortBy]: sortOrder };
  }

  let totalProducts = await prisma.product.count({ where });
  let moreProducts = await prisma.product.findMany({
    include: {
      brand: true,
      mediaLinks: {
        include: {
          media: true
        }
      },
      variants: true
    },
    where,
    take: 10,
    skip: offset,
    orderBy
  });
  let newOffset = moreProducts.length + offset;

  return {
    products: moreProducts,
    newOffset: newOffset,
    totalProducts: totalProducts
  };
}

export async function deleteProductById(id: string) {
  await prisma.product.deleteMany({ where: { id: { equals: id } } })
}

export async function updateProduct(product: any){
  return await prisma.product.update({
    where: {id: product.id},
    data: product
  })
}

export async function getAllBrands() {
  return prisma.brand.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });
}