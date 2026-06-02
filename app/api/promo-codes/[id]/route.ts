import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildUpdateAuditFields, getAdminUserIdFromSession } from '@/lib/admin-audit';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PromoCodeType = 'percentage' | 'fixed_amount' | 'free_shipping' | 'total_cap';

function isPromoCodeType(value: unknown): value is PromoCodeType {
  return value === 'percentage' || value === 'fixed_amount' || value === 'free_shipping' || value === 'total_cap';
}

function parseOptionalInt(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.trunc(n);
}

function parseOptionalDecimal(value: unknown): string | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n.toFixed(2);
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function validateByType(type: PromoCodeType, fields: { percentageOff: string | null; fixedAmountOff: number | null; maxPayableAmount: number | null; }) {
  if (type === 'percentage' && fields.percentageOff === null) {
    return 'percentageOff is required for percentage promo codes';
  }
  if (type === 'fixed_amount' && fields.fixedAmountOff === null) {
    return 'fixedAmountOff is required for fixed amount promo codes';
  }
  if (type === 'total_cap' && fields.maxPayableAmount === null) {
    return 'maxPayableAmount is required for total cap promo codes';
  }
  return null;
}

// GET /api/promo-codes/[id]
export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const promo = await prisma.promoCode.findUnique({ where: { id } });
    if (!promo) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
    }
    return NextResponse.json(promo);
  } catch (error) {
    console.error('Error fetching promo code:', error);
    return NextResponse.json({ error: 'Failed to fetch promo code' }, { status: 500 });
  }
}

// PUT /api/promo-codes/[id]
export async function PUT(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminUserId = getAdminUserIdFromSession(session);
  const { id } = await params;

  try {
    const body = await request.json();

    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
    }

    const requestedType = body.type ?? existing.type;
    if (!isPromoCodeType(requestedType)) {
      return NextResponse.json({ error: 'Invalid promo code type' }, { status: 400 });
    }

    const type = requestedType;
    const percentageOff = parseOptionalDecimal(body.percentageOff ?? existing.percentageOff);
    const fixedAmountOff = parseOptionalInt(body.fixedAmountOff ?? existing.fixedAmountOff);
    const maxPayableAmount = parseOptionalInt(body.maxPayableAmount ?? existing.maxPayableAmount);

    const validationError = validateByType(type, { percentageOff, fixedAmountOff, maxPayableAmount });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const promo = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(body.code !== undefined ? { code: String(body.code).trim() } : {}),
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
        ...(body.type !== undefined ? { type } : {}),
        ...(body.percentageOff !== undefined ? { percentageOff } : {}),
        ...(body.fixedAmountOff !== undefined ? { fixedAmountOff } : {}),
        ...(body.maxPayableAmount !== undefined ? { maxPayableAmount } : {}),
        ...(body.minSubtotal !== undefined ? { minSubtotal: parseOptionalInt(body.minSubtotal) } : {}),
        ...(body.maxDiscountAmount !== undefined ? { maxDiscountAmount: parseOptionalInt(body.maxDiscountAmount) } : {}),
        ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
        ...(body.startsAt !== undefined ? { startsAt: parseOptionalDate(body.startsAt) } : {}),
        ...(body.endsAt !== undefined ? { endsAt: parseOptionalDate(body.endsAt) } : {}),
        ...(body.usageLimit !== undefined ? { usageLimit: parseOptionalInt(body.usageLimit) } : {}),
        ...(body.perCustomerLimit !== undefined ? { perCustomerLimit: parseOptionalInt(body.perCustomerLimit) } : {}),
        ...(body.metadata !== undefined ? { metadata: body.metadata ?? undefined } : {}),
        ...buildUpdateAuditFields(adminUserId),
      },
    });

    return NextResponse.json(promo);
  } catch (error) {
    console.error('Error updating promo code:', error);
    return NextResponse.json({ error: 'Failed to update promo code' }, { status: 500 });
  }
}

// DELETE /api/promo-codes/[id]
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.promoCode.delete({ where: { id } });
    return NextResponse.json({ message: 'Promo code deleted' });
  } catch (error) {
    console.error('Error deleting promo code:', error);
    return NextResponse.json({ error: 'Failed to delete promo code' }, { status: 500 });
  }
}
