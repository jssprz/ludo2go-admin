import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/purchase-orders/[id]
export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            variant: {
              select: { id: true, sku: true, product: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    );
  }
}

// PUT /api/purchase-orders/[id]
export async function PUT(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      status, notes, tax, shipping, orderedAt, expectedAt, receivedAt,
      items, // optional: full replacement of items
    } = body;

    // If items are being replaced, recalculate totals
    let subtotal: number | undefined;
    if (items && Array.isArray(items)) {
      // Delete existing items
      await prisma.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: id },
      });

      const orderItems = items.map((item: any) => ({
        purchaseOrderId: id,
        variantId: item.variantId,
        quantity: Number(item.quantity) || 0,
        quantityReceived: Number(item.quantityReceived) || 0,
        unitCost: Number(item.unitCost) || 0,
        total: (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
      }));

      if (orderItems.length > 0) {
        await prisma.purchaseOrderItem.createMany({ data: orderItems });
      }

      subtotal = orderItems.reduce((sum: number, i: any) => sum + i.total, 0);
    }

    const currentOrder = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!currentOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const finalSubtotal = subtotal !== undefined ? subtotal : currentOrder.subtotal;
    const finalTax = typeof tax === 'number' ? tax : currentOrder.tax;
    const finalShipping = typeof shipping === 'number' ? shipping : currentOrder.shipping;

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(status ? { status: status as any } : {}),
        notes: notes !== undefined ? (notes || null) : undefined,
        subtotal: finalSubtotal,
        tax: finalTax,
        shipping: finalShipping,
        total: finalSubtotal + finalTax + finalShipping,
        orderedAt: orderedAt !== undefined ? (orderedAt ? new Date(orderedAt) : null) : undefined,
        expectedAt: expectedAt !== undefined ? (expectedAt ? new Date(expectedAt) : null) : undefined,
        receivedAt: receivedAt !== undefined ? (receivedAt ? new Date(receivedAt) : null) : undefined,
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

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to update purchase order' },
      { status: 500 }
    );
  }
}

// DELETE /api/purchase-orders/[id]
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Delete items first, then the order
    await prisma.purchaseOrderItem.deleteMany({
      where: { purchaseOrderId: id },
    });
    await prisma.purchaseOrder.delete({ where: { id } });
    return NextResponse.json({ message: 'Purchase order deleted' });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase order' },
      { status: 500 }
    );
  }
}
