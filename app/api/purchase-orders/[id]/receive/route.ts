import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

type ReceiveItem = {
  itemId: string;
  quantityNow: number;
};

const RECEIVABLE = new Set(['submitted', 'confirmed', 'partially_received']);

// POST /api/purchase-orders/[id]/receive
export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { locationId, items } = body as { locationId: string; items: ReceiveItem[] };

    if (!locationId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'locationId and at least one item are required' },
        { status: 400 },
      );
    }

    const validItems = items.filter((i) => i.quantityNow > 0);
    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'At least one item must have quantity > 0' },
        { status: 400 },
      );
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    if (!RECEIVABLE.has(order.status)) {
      return NextResponse.json(
        { error: `Cannot receive a PO with status "${order.status}"` },
        { status: 422 },
      );
    }

    // Validate quantities: cannot receive more than what is pending
    const itemMap = new Map(order.items.map((i) => [i.id, i]));
    for (const recv of validItems) {
      const existing = itemMap.get(recv.itemId);
      if (!existing) {
        return NextResponse.json(
          { error: `Item ${recv.itemId} not found in this order` },
          { status: 400 },
        );
      }
      const pending = existing.quantity - existing.quantityReceived;
      if (recv.quantityNow > pending) {
        return NextResponse.json(
          {
            error: `Item ${recv.itemId}: trying to receive ${recv.quantityNow} but only ${pending} pending`,
          },
          { status: 422 },
        );
      }
    }

    const [updatedOrder] = await prisma.$transaction(async (tx) => {
      // 1. Update quantityReceived on each item and upsert inventory
      for (const recv of validItems) {
        const existing = itemMap.get(recv.itemId)!;
        const newReceived = existing.quantityReceived + recv.quantityNow;

        await tx.purchaseOrderItem.update({
          where: { id: recv.itemId },
          data: { quantityReceived: newReceived },
        });

        await tx.inventory.upsert({
          where: {
            variantId_locationId: {
              variantId: existing.variantId,
              locationId,
            },
          },
          update: { onHand: { increment: recv.quantityNow } },
          create: {
            variantId: existing.variantId,
            locationId,
            onHand: recv.quantityNow,
            reserved: 0,
          },
        });
      }

      // 2. Reload items to determine new PO status
      const refreshed = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { items: true },
      });

      const allReceived = refreshed!.items.every(
        (i) => i.quantityReceived >= i.quantity,
      );
      const anyReceived = refreshed!.items.some((i) => i.quantityReceived > 0);

      const newStatus = allReceived
        ? 'received'
        : anyReceived
          ? 'partially_received'
          : order.status;

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus as any,
          ...(allReceived && !order.receivedAt ? { receivedAt: new Date() } : {}),
        },
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          items: {
            include: {
              variant: {
                select: { id: true, sku: true, product: { select: { name: true } } },
              },
            },
          },
        },
      });

      return [updated];
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error('Error receiving purchase order:', error);
    return NextResponse.json({ error: 'Failed to process receipt' }, { status: 500 });
  }
}
