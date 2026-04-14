import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/purchase-orders - List all purchase orders
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const orders = await prisma.purchaseOrder.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true } },
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase orders' },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders - Create a new purchase order
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      code, supplierId, currency, notes, orderedAt, expectedAt,
      items, // Array of { variantId, quantity, unitCost }
    } = body;

    if (!code || !supplierId) {
      return NextResponse.json(
        { error: 'Code and supplier are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.purchaseOrder.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json(
        { error: 'A purchase order with this code already exists' },
        { status: 400 }
      );
    }

    // Calculate totals from items
    const orderItems = (items || []).map((item: any) => ({
      variantId: item.variantId,
      quantity: Number(item.quantity) || 0,
      quantityReceived: 0,
      unitCost: Number(item.unitCost) || 0,
      total: (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
    }));

    const subtotal = orderItems.reduce((sum: number, i: any) => sum + i.total, 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        code,
        supplierId,
        status: 'draft',
        currency: currency || 'CLP',
        subtotal,
        tax: 0,
        shipping: 0,
        total: subtotal,
        notes: notes || null,
        orderedAt: orderedAt ? new Date(orderedAt) : null,
        expectedAt: expectedAt ? new Date(expectedAt) : null,
        ...(orderItems.length > 0
          ? { items: { create: orderItems } }
          : {}),
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

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}
