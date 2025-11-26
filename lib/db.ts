import 'server-only';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import {
  pgTable,
  text,
  numeric,
  integer,
  timestamp,
  pgEnum,
  serial
} from 'drizzle-orm/pg-core';
import { count, eq, ilike } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { prisma } from '@jssprz/ludo2go-database';
import { ProductStatus } from '@prisma/client';

export async function getProducts(
  search: string,
  offset: number,
  status: ProductStatus | undefined
) {
  // Always search the full table, not per page

  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.status = status;
  }

  let totalProducts = await prisma.product.count({ where });
  let moreProducts = await prisma.product.findMany({
    include: {
      mediaLinks: {
        include: {
          media: true
        }
      },
      variants: true
    }, 
    where, 
    take: 5, 
    skip: offset,
    orderBy: { createdAt: 'desc' }
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