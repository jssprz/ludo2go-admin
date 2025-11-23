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

export const db = drizzle(neon(process.env.POSTGRES_URL!));

export const statusEnum = pgEnum('status', ['active', 'inactive', 'archived']);

// export const products = pgTable('products', {
//   id: serial('id').primaryKey(),
//   imageUrl: text('image_url').notNull(),
//   name: text('name').notNull(),
//   status: statusEnum('status').notNull(),
//   price: numeric('price', { precision: 10, scale: 2 }).notNull(),
//   stock: integer('stock').notNull(),
//   availableAt: timestamp('available_at').notNull()
// });

// export type SelectProduct = typeof products.$inferSelect;
// export const insertProductSchema = createInsertSchema(products);


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