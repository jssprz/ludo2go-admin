import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildCreateAuditFields, getAdminUserIdFromSession } from '@/lib/admin-audit';

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

// GET /api/promo-codes
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    const promoCodes = await prisma.promoCode.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(promoCodes);
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return NextResponse.json({ error: 'Failed to fetch promo codes' }, { status: 500 });
  }
}

// POST /api/promo-codes
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminUserId = getAdminUserIdFromSession(session);

  try {
    const body = await request.json();
    if (!isPromoCodeType(body.type)) {
      return NextResponse.json({ error: 'Invalid promo code type' }, { status: 400 });
    }

    const type = body.type;

    if (!body.code || !body.name || !type) {
      return NextResponse.json({ error: 'code, name and type are required' }, { status: 400 });
    }

    const percentageOff = parseOptionalDecimal(body.percentageOff);
    const fixedAmountOff = parseOptionalInt(body.fixedAmountOff);
    const maxPayableAmount = parseOptionalInt(body.maxPayableAmount);

    const validationError = validateByType(type, { percentageOff, fixedAmountOff, maxPayableAmount });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existing = await prisma.promoCode.findUnique({ where: { code: String(body.code).trim() } });
    if (existing) {
      return NextResponse.json({ error: 'Promo code with this code already exists' }, { status: 400 });
    }

    const promo = await prisma.promoCode.create({
      data: {
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        description: body.description ? String(body.description) : null,
        type,
        percentageOff,
        fixedAmountOff,
        maxPayableAmount,
        minSubtotal: parseOptionalInt(body.minSubtotal),
        maxDiscountAmount: parseOptionalInt(body.maxDiscountAmount),
        active: typeof body.active === 'boolean' ? body.active : true,
        startsAt: parseOptionalDate(body.startsAt),
        endsAt: parseOptionalDate(body.endsAt),
        usageLimit: parseOptionalInt(body.usageLimit),
        perCustomerLimit: parseOptionalInt(body.perCustomerLimit),
        metadata: body.metadata ?? undefined,
        ...buildCreateAuditFields(adminUserId),
      },
    });

    return NextResponse.json(promo, { status: 201 });
  } catch (error) {
    console.error('Error creating promo code:', error);
    return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 });
  }
}
