import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/bundles/[id] – Full bundle details
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        brand: { select: { id: true, name: true } },
        bundle: {
          include: {
            items: {
              include: {
                variant: {
                  select: {
                    id: true,
                    sku: true,
                    product: { select: { name: true } },
                  },
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

    if (!product || !product.bundle) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching bundle:', error);
    return NextResponse.json({ error: 'Failed to fetch bundle' }, { status: 500 });
  }
}

// PUT /api/bundles/[id] – Update BundleDetails + CustomizableBundleDetails
export async function PUT(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const {
    bundleType,
    notes,
    // customizable details
    pricingMode,
    minTotalSelections,
    maxTotalSelections,
    instructions,
    // fixed items replacement
    items,
  } = body;

  try {
    // Upsert BundleDetails
    const bundle = await prisma.bundleDetails.upsert({
      where: { productId: id },
      create: {
        productId: id,
        bundleType: bundleType ?? 'custom',
        notes: notes ?? null,
      },
      update: {
        ...(bundleType ? { bundleType } : {}),
        notes: notes !== undefined ? (notes || null) : undefined,
      },
    });

    // If items provided, replace them
    if (Array.isArray(items)) {
      await prisma.bundleItem.deleteMany({ where: { bundleId: id } });
      if (items.length > 0) {
        await prisma.bundleItem.createMany({
          data: items
            .filter((i: any) => !!i.variantId)
            .map((i: any) => ({
              bundleId: id,
              variantId: i.variantId,
              quantity: Math.max(1, Number(i.quantity) || 1),
            })),
        });
      }
    }

    // Upsert CustomizableBundleDetails when bundleType is customizable
    const isCustomizable =
      bundleType === 'customizable' ||
      (bundleType === undefined && bundle.bundleType === 'customizable');

    if (isCustomizable) {
      await prisma.customizableBundleDetails.upsert({
        where: { bundleProductId: id },
        create: {
          bundleProductId: id,
          pricingMode: pricingMode ?? 'base_plus_options',
          minTotalSelections: minTotalSelections ?? null,
          maxTotalSelections: maxTotalSelections ?? null,
          instructions: instructions ?? null,
        },
        update: {
          ...(pricingMode ? { pricingMode } : {}),
          minTotalSelections: minTotalSelections !== undefined ? minTotalSelections : undefined,
          maxTotalSelections: maxTotalSelections !== undefined ? maxTotalSelections : undefined,
          instructions: instructions !== undefined ? (instructions || null) : undefined,
        },
      });
    }

    // Return refreshed full bundle
    const updated = await prisma.product.findUnique({
      where: { id },
      include: {
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating bundle:', error);
    return NextResponse.json({ error: 'Failed to update bundle' }, { status: 500 });
  }
}
