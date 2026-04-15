import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/cost-prices - List cost prices
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const supplierId = searchParams.get('supplierId');
    const variantId = searchParams.get('variantId');
    const activeOnly = searchParams.get('active') === 'true';

    const costPrices = await prisma.costPrice.findMany({
      where: {
        ...(supplierId ? { supplierId } : {}),
        ...(variantId ? { variantId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        variant: {
          select: { id: true, sku: true, product: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json(costPrices);
  } catch (error) {
    console.error('Error fetching cost prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost prices' },
      { status: 500 }
    );
  }
}

// POST /api/cost-prices - Create a new cost price
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      variantId, supplierId, currency, amount, taxIncluded,
      moq, notes, effectiveFrom, effectiveTo, isActive,
    } = body;

    if (!variantId || !supplierId || amount === undefined) {
      return NextResponse.json(
        { error: 'Variant, supplier, and amount are required' },
        { status: 400 }
      );
    }

    const costPrice = await prisma.costPrice.create({
      data: {
        variantId,
        supplierId,
        currency: currency || 'CLP',
        amount: Number(amount),
        taxIncluded: typeof taxIncluded === 'boolean' ? taxIncluded : false,
        moq: typeof moq === 'number' ? moq : null,
        notes: notes || null,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        variant: {
          select: { id: true, sku: true, product: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json(costPrice, { status: 201 });
  } catch (error) {
    console.error('Error creating cost price:', error);
    return NextResponse.json(
      { error: 'Failed to create cost price' },
      { status: 500 }
    );
  }
}
