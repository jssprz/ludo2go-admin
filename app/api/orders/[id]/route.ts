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
    const { status, courierTrackingNumber, courierId } = parsed.data;

    const { id } = await params;
    const previousOrder = await prisma.order.findUnique({
      where: { id },
      select: { status: true, updatedAt: true },
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

    const changedAt = new Date();
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

      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          courier: true,
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          items: { include: { variant: { include: { product: true } } } },
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
            actorId: typeof session.user?.id === 'string' ? session.user.id : null,
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
