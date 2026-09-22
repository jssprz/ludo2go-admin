import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';
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

// PATCH update order status
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !Object.values(OrderStatus).includes(status)) {
      return NextResponse.json(
        { message: 'Invalid order status' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        status: status as OrderStatus,
        updatedAt: new Date(),
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (existingOrder.status !== order.status && order.customer?.email) {
      void sendOrderStatusNotification({
        orderId: order.id,
        customerEmail: order.customer.email,
        customerName: [order.customer.firstName, order.customer.lastName]
          .filter(Boolean)
          .join(' '),
        previousStatus: existingOrder.status,
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
