import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// POST /api/inventory/transfer
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { variantId, fromLocationId, toLocationId, quantity } = body as {
      variantId: string;
      fromLocationId: string;
      toLocationId: string;
      quantity: number;
    };

    if (!variantId || !fromLocationId || !toLocationId || !quantity) {
      return NextResponse.json(
        { error: 'variantId, fromLocationId, toLocationId and quantity are required' },
        { status: 400 },
      );
    }

    if (fromLocationId === toLocationId) {
      return NextResponse.json(
        { error: 'Source and destination locations must be different' },
        { status: 400 },
      );
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 });
    }

    const source = await prisma.inventory.findUnique({
      where: { variantId_locationId: { variantId, locationId: fromLocationId } },
    });

    const available = source ? source.onHand - source.reserved : 0;
    if (available < quantity) {
      return NextResponse.json(
        {
          error: `Insufficient available stock. Available: ${available}, requested: ${quantity}`,
        },
        { status: 422 },
      );
    }

    const [from, to] = await prisma.$transaction([
      prisma.inventory.update({
        where: { variantId_locationId: { variantId, locationId: fromLocationId } },
        data: { onHand: { decrement: quantity } },
      }),
      prisma.inventory.upsert({
        where: { variantId_locationId: { variantId, locationId: toLocationId } },
        update: { onHand: { increment: quantity } },
        create: { variantId, locationId: toLocationId, onHand: quantity, reserved: 0 },
      }),
    ]);

    return NextResponse.json({ from, to });
  } catch (error) {
    console.error('Error transferring inventory:', error);
    return NextResponse.json({ error: 'Failed to transfer inventory' }, { status: 500 });
  }
}
