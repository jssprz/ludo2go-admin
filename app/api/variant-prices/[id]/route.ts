import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { PriceCurrency } from '@prisma/client';

import { auth } from '@/lib/auth';
import {
  buildCreateAuditFields,
  buildUpdateAuditFields,
  getAdminUserIdFromSession,
} from '@/lib/admin-audit';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseAmount(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const adminUserId = getAdminUserIdFromSession(session);
    const { id: variantId } = await context.params;
    const body = await request.json();

    const retailAmount = parseAmount(body.retailAmount);
    const saleAmount = parseAmount(body.saleAmount);

    if (retailAmount == null) {
      return NextResponse.json(
        { message: 'retailAmount is required and must be a non-negative number' },
        { status: 400 }
      );
    }

    if (saleAmount != null && saleAmount > retailAmount) {
      return NextResponse.json(
        { message: 'saleAmount cannot be greater than retailAmount' },
        { status: 400 }
      );
    }

    const currency = (body.currency ?? 'CLP') as PriceCurrency;

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) {
      return NextResponse.json({ message: 'Variant not found' }, { status: 404 });
    }

    const prices = await prisma.price.findMany({
      where: {
        variantId,
        active: true,
        type: { in: ['retail', 'sale'] },
      },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    });

    const retailPrice = prices.find((price) => price.type === 'retail');
    const salePrice = prices.find((price) => price.type === 'sale');

    if (retailPrice) {
      await prisma.price.update({
        where: { id: retailPrice.id },
        data: {
          amount: retailAmount,
          currency,
          active: true,
          ...buildUpdateAuditFields(adminUserId),
        },
      });
    } else {
      await prisma.price.create({
        data: {
          variantId,
          amount: retailAmount,
          currency,
          type: 'retail',
          active: true,
          ...buildCreateAuditFields(adminUserId),
        },
      });
    }

    if (saleAmount == null) {
      if (salePrice) {
        await prisma.price.deleteMany({
          where: {
            variantId,
            active: true,
            type: 'sale',
          },
        });
      }
    } else if (salePrice) {
      await prisma.price.update({
        where: { id: salePrice.id },
        data: {
          amount: saleAmount,
          currency,
          active: true,
          ...buildUpdateAuditFields(adminUserId),
        },
      });
    } else {
      await prisma.price.create({
        data: {
          variantId,
          amount: saleAmount,
          currency,
          type: 'sale',
          active: true,
          ...buildCreateAuditFields(adminUserId),
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error updating variant prices:', error);
    return NextResponse.json(
      { message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
