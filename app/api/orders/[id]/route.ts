import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { canEditOrderTracking, orderUpdateSchema } from '@/lib/order-update';
import { sendOrderStatusNotification } from '@/lib/order-status-email';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// GET single order
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        courier: true,
        items: {
          include: {
            cancellations: true,
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        shippingAddr: true,
        billingAddr: true,
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// PATCH update order status or courier tracking
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = orderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { status, courierTrackingNumber, courierId, addItem, cancelItem, giftItem } = parsed.data;

    const { id } = await params;
    const previousOrder = await prisma.order.findUnique({
      where: { id },
      select: {
        status: true,
        updatedAt: true,
        tax: true,
        shipping: true,
        promoDiscount: true,
        currency: true,
      },
    });

    if (!previousOrder) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }
    const nextStatus = status ?? previousOrder.status;
    if ((courierTrackingNumber !== undefined || courierId !== undefined) && !canEditOrderTracking(nextStatus)) {
      return NextResponse.json({ message: 'Courier tracking can only be edited for ready_to_ship, shipped, delivered or cancelled orders.' }, { status: 400 });
    }

    if (courierId && !await prisma.courier.findUnique({ where: { id: courierId }, select: { id: true } })) {
      return NextResponse.json({ message: 'Courier not found.' }, { status: 400 });
    }

    if (addItem && !await prisma.productVariant.findUnique({ where: { id: addItem.variantId }, select: { id: true } })) {
      return NextResponse.json({ message: 'Variant not found.' }, { status: 400 });
    }

    const changedAt = new Date();
    const actorId = typeof session.user?.id === 'string' ? session.user.id : null;
    const hasItemOperation = Boolean(addItem || cancelItem || giftItem);
    const updateResult = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id, status: previousOrder.status, updatedAt: previousOrder.updatedAt },
        data: {
          status: nextStatus,
          ...(courierId === undefined ? {} : { courierId }),
          ...(courierTrackingNumber === undefined ? {} : { courierTrackingNumber: courierTrackingNumber || null }),
          updatedAt: changedAt
        },
      });

      if (updated.count !== 1) return null;

      if (addItem) {
        await tx.orderItem.create({
          data: {
            orderId: id,
            variantId: addItem.variantId,
            quantity: addItem.quantity,
            unitPrice: addItem.unitPrice,
            currency: previousOrder.currency,
            isGift: addItem.isGift,
            giftReason: addItem.giftReason,
            giftedAt: addItem.isGift ? changedAt : null,
            giftedBy: addItem.isGift ? actorId : null,
          },
        });
      }

      if (giftItem) {
        const orderItem = await tx.orderItem.findFirst({
          where: { id: giftItem.orderItemId, orderId: id },
          select: { id: true },
        });
        if (!orderItem) throw new Error('Order item not found.');
        await tx.orderItem.update({
          where: { id: orderItem.id },
          data: {
            isGift: giftItem.isGift,
            giftReason: giftItem.giftReason,
            giftedAt: giftItem.isGift ? changedAt : null,
            giftedBy: giftItem.isGift ? actorId : null,
          },
        });
      }

      if (cancelItem) {
        const orderItem = await tx.orderItem.findFirst({
          where: { id: cancelItem.orderItemId, orderId: id },
          select: {
            id: true,
            quantity: true,
            cancellations: { select: { quantity: true } },
          },
        });
        if (!orderItem) throw new Error('Order item not found.');
        const cancelled = orderItem.cancellations.reduce((sum, entry) => sum + entry.quantity, 0);
        const remaining = orderItem.quantity - cancelled;
        if (cancelItem.quantity > remaining) {
          throw new Error(`Cannot cancel ${cancelItem.quantity} units; only ${remaining} remaining.`);
        }
        await tx.orderItemCancellation.create({
          data: {
            orderItemId: orderItem.id,
            quantity: cancelItem.quantity,
            reason: cancelItem.reason,
            details: cancelItem.details,
            cancelledAt: changedAt,
            actorType: 'ADMIN',
            actorId,
          },
        });
      }

      if (hasItemOperation) {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: id },
          select: {
            quantity: true,
            unitPrice: true,
            isGift: true,
            cancellations: { select: { quantity: true } },
          },
        });
        const subtotal = orderItems.reduce((sum, item) => {
          const cancelled = item.cancellations.reduce((subtotalSum, entry) => subtotalSum + entry.quantity, 0);
          const remaining = Math.max(0, item.quantity - cancelled);
          return sum + (item.isGift ? 0 : remaining * item.unitPrice);
        }, 0);
        const total = Math.max(0, subtotal + previousOrder.tax + previousOrder.shipping - previousOrder.promoDiscount);
        await tx.order.update({
          where: { id },
          data: {
            subtotal,
            total,
            updatedAt: changedAt,
          },
        });
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          courier: true,
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          items: { include: { cancellations: true, variant: { include: { product: true } } } },
        },
      });

      if (previousOrder.status !== order.status) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            fromStatus: previousOrder.status,
            toStatus: order.status,
            changedAt,
            actorType: 'ADMIN',
            actorId,
          },
        });
      }

      return order;
    });

    if (!updateResult) {
      return NextResponse.json(
        { message: 'Order changed during this update. Refresh and try again.' },
        { status: 409 }
      );
    }

    const order = updateResult;
    if (previousOrder.status !== order.status && order.customer?.email) {
      void sendOrderStatusNotification({
        orderId: order.id,
        customerEmail: order.customer.email,
        customerName: [order.customer.firstName, order.customer.lastName]
          .filter(Boolean)
          .join(' '),
        previousStatus: previousOrder.status,
        status: order.status,
        total: order.total,
        currency: order.currency,
        itemNames: order.items.map(
          (item) => item.variant?.product?.name ?? item.variant?.sku ?? 'Producto'
        ),
      });
    }

    return NextResponse.json(order);
  } catch (error: any) {
    if (error instanceof Error && (
      error.message === 'Order item not found.'
      || error.message.startsWith('Cannot cancel ')
    )) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error('Error updating order:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to update order' },
      { status: 500 }
    );
  }
}

// DELETE order (optional - use with caution)
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.order.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to delete order' },
      { status: 500 }
    );
  }
}
