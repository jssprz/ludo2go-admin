import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// PUT /api/cost-prices/[id]
export async function PUT(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      currency, amount, taxIncluded, moq, notes,
      effectiveFrom, effectiveTo, isActive,
    } = body;

    const costPrice = await prisma.costPrice.update({
      where: { id },
      data: {
        ...(currency ? { currency: currency as any } : {}),
        ...(amount !== undefined ? { amount: Number(amount) } : {}),
        ...(typeof taxIncluded === 'boolean' ? { taxIncluded } : {}),
        moq: moq !== undefined ? (typeof moq === 'number' ? moq : null) : undefined,
        notes: notes !== undefined ? (notes || null) : undefined,
        ...(effectiveFrom ? { effectiveFrom: new Date(effectiveFrom) } : {}),
        effectiveTo: effectiveTo !== undefined ? (effectiveTo ? new Date(effectiveTo) : null) : undefined,
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        variant: {
          select: { id: true, sku: true, product: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json(costPrice);
  } catch (error) {
    console.error('Error updating cost price:', error);
    return NextResponse.json(
      { error: 'Failed to update cost price' },
      { status: 500 }
    );
  }
}

// DELETE /api/cost-prices/[id]
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.costPrice.delete({ where: { id } });
    return NextResponse.json({ message: 'Cost price deleted' });
  } catch (error) {
    console.error('Error deleting cost price:', error);
    return NextResponse.json(
      { error: 'Failed to delete cost price' },
      { status: 500 }
    );
  }
}
