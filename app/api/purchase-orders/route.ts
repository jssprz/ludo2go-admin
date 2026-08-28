import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

function getPoYear(date: Date) {
  return date.getFullYear();
}

function formatPoCode(year: number, sequence: number) {
  return `PO-${year}-${String(sequence).padStart(4, '0')}`;
}

async function generateNextPoCode(now = new Date()) {
  const year = getPoYear(now);
  const prefix = `PO-${year}-`;

  const existingCodes = await prisma.purchaseOrder.findMany({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    select: { code: true },
  });

  const maxSequence = existingCodes.reduce((max, row) => {
    const suffix = row.code.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (!Number.isFinite(parsed)) {
      return max;
    }

    return Math.max(max, parsed);
  }, 0);

  return formatPoCode(year, maxSequence + 1);
}

function isUniqueCodeError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes('Unique constraint') || error.message.includes('PurchaseOrder_code_key');
}

function normalizeItem(item: any) {
  const quantity = Math.max(0, Number(item?.quantity) || 0);
  const quantityReceived = Math.max(0, Number(item?.quantityReceived) || 0);
  const unitCost = Math.max(0, Number(item?.unitCost) || 0);
  const discount = Math.max(0, Number(item?.discount) || 0);
  const gross = quantity * unitCost;
  const total = Math.max(0, gross - discount);

  return {
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
        items: {
          include: {
            variant: {
              select: { id: true, sku: true, product: { select: { name: true } } },
            },
          },
        },
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
      supplierId, currency, notes, orderedAt, expectedAt,
      shipping,
      includeShippingInTax,
      pdfFileUrl,
      items, // Array of { variantId, quantity, unitCost, discount }
    } = body;

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Supplier is required' },
        { status: 400 }
      );
    }

    // Calculate totals from items
    const orderItems = (items || [])
      .map((item: any) => normalizeItem(item))
      .filter((item: any) => !!item.variantId);

    const uniqueVariantIds = new Set(orderItems.map((item: any) => item.variantId));
    if (uniqueVariantIds.size !== orderItems.length) {
      return NextResponse.json(
        { error: 'Duplicate variants are not allowed in the same purchase order' },
        { status: 400 }
      );
    }

    const subtotal = orderItems.reduce((sum: number, i: any) => sum + i.total, 0);
    const normalizedShipping = Math.max(0, Number(shipping) || 0);
    const totals = calculateTotals(subtotal, normalizedShipping, !!includeShippingInTax);

    let order = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!order && attempts < maxAttempts) {
      attempts += 1;
      const generatedCode = await generateNextPoCode();

      try {
        order = await prisma.purchaseOrder.create({
          data: {
            code: generatedCode,
            supplierId,
            status: 'draft',
            currency: currency || 'CLP',
            subtotal: totals.subtotal,
            tax: totals.tax,
            shipping: normalizedShipping,
            total: totals.total,
            pdfFileUrl:
              typeof pdfFileUrl === 'string' && pdfFileUrl.trim().length > 0
                ? pdfFileUrl.trim()
                : null,
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
      } catch (error) {
        if (!isUniqueCodeError(error) || attempts >= maxAttempts) {
          throw error;
        }
      }
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Failed to generate a unique purchase order code' },
        { status: 500 }
      );
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to create purchase order' },
      { status: 500 }
    );
  }
}
