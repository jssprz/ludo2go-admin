import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

function normalizeItem(item: any, purchaseOrderId: string) {
  const quantity = Math.max(0, Number(item?.quantity) || 0);
  const quantityReceived = Math.max(0, Number(item?.quantityReceived) || 0);
  const unitCost = Math.max(0, Number(item?.unitCost) || 0);
  const discount = Math.max(0, Number(item?.discount) || 0);
  const gross = quantity * unitCost;
  const total = Math.max(0, gross - discount);

  return {
    purchaseOrderId,
    variantId: item?.variantId,
    quantity,
    quantityReceived,
    unitCost,
    discount,
    total,
  };
}

function calculateTotals(
  subtotal: number,
  shipping: number,
  includeShippingInTax: boolean
) {
  const taxBase = subtotal + (includeShippingInTax ? shipping : 0);
  const tax = Math.round(taxBase * 0.19);
  return {
    subtotal,
    tax,
    total: subtotal + shipping + tax,
  };
}

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
      status, notes, pdfFileUrl, shipping, includeShippingInTax, orderedAt, expectedAt, receivedAt,
      items, // optional: full replacement of items
    } = body;

    // If items are being replaced, recalculate totals
    let subtotal: number | undefined;
    if (items && Array.isArray(items)) {
      // Delete existing items
      await prisma.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: id },
      });

      const orderItems = items
        .map((item: any) => normalizeItem(item, id))
        .filter((item: any) => !!item.variantId);

      const uniqueVariantIds = new Set(orderItems.map((item: any) => item.variantId));
      if (uniqueVariantIds.size !== orderItems.length) {
        return NextResponse.json(
          { error: 'Duplicate variants are not allowed in the same purchase order' },
          { status: 400 }
        );
      }

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
    const finalShipping = Math.max(0, typeof shipping === 'number' ? shipping : currentOrder.shipping);
    const includeShippingForTax =
      typeof includeShippingInTax === 'boolean'
        ? includeShippingInTax
        : Math.abs(currentOrder.tax - Math.round((currentOrder.subtotal + currentOrder.shipping) * 0.19)) <=
          Math.abs(currentOrder.tax - Math.round(currentOrder.subtotal * 0.19));
    const totals = calculateTotals(finalSubtotal, finalShipping, includeShippingForTax);

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(status ? { status: status as any } : {}),
        notes: notes !== undefined ? (notes || null) : undefined,
        pdfFileUrl:
          pdfFileUrl !== undefined
            ? (typeof pdfFileUrl === 'string' && pdfFileUrl.trim().length > 0 ? pdfFileUrl.trim() : null)
            : undefined,
        subtotal: totals.subtotal,
        tax: totals.tax,
        shipping: finalShipping,
        total: totals.total,
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
