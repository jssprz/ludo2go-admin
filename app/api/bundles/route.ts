import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/bundles – List all bundle products with their details
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const bundles = await prisma.product.findMany({
      where: { kind: 'bundle' },
      orderBy: { name: 'asc' },
      include: {
        brand: { select: { id: true, name: true } },
        bundle: {
          include: {
            items: {
              include: {
                variant: {
                  select: { id: true, sku: true, product: { select: { name: true } } },
                },
              },
            },
            customizableDetails: {
              include: {
                optionGroups: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    options: { orderBy: { sortOrder: 'asc' } },
                    variantSelectionRule: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return NextResponse.json(bundles);
  } catch (error) {
    console.error('Error fetching bundles:', error);
    return NextResponse.json({ error: 'Failed to fetch bundles' }, { status: 500 });
  }
}
