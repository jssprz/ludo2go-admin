import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      customerId,
      items,
      subtotal,
      tax,
      shipping,
      discount,
      total,
      currency,
      paymentMethod,
      paymentStatus,
      notes,
      shippingAddrId,
    } = body;

    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { message: 'Customer and items are required' },
        { status: 400 }
      );
    }

    // Create the order
    const order = await prisma.order.create({
      data: {
        customerId,
        currency: currency || 'CLP',
        subtotal,
        tax,
        shipping,
        discount: discount || 0,
        total,
        status: 'pending',
        notes: notes || null,
        shippingAddrId: shippingAddrId || null,
        items: {
          create: items.map((item: any) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            currency: currency || 'CLP',
          })),
        },
        ...(paymentMethod && {
          payments: {
            create: {
              method: paymentMethod,
              status: paymentStatus || 'pending',
              amount: total,
              currency: currency || 'CLP',
            },
          },
        }),
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
        shippingAddr: true,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error('Error creating manual order:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
