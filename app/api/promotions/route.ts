import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
const VALID_MODES = ['AUTOMATIC', 'PROMO_CODE'] as const;

function parseOptionalDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptionalInt(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return Math.trunc(n);
}

function parseJsonField(field: unknown, fieldName: string, defaultValue: any = {}): any {
  if (field === null || field === undefined || field === '') {
    return defaultValue;
  }
  if (typeof field === 'object') {
    return field;
  }
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch {
      throw new Error(`Invalid JSON format in ${fieldName}`);
    }
  }
  return defaultValue;
}

// GET /api/promotions - List all promotions
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim().toLowerCase();
    const status = searchParams.get('status')?.trim().toUpperCase();
    const mode = searchParams.get('mode')?.trim().toUpperCase();

    const where: any = {};
    if (status && VALID_STATUSES.includes(status as any)) {
      where.status = status;
    }
    if (mode && VALID_MODES.includes(mode as any)) {
      where.activationMode = mode;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          promoCodeLinks: {
            some: {
              promoCode: {
                code: { contains: search, mode: 'insensitive' },
              },
            },
          },
        },
      ];
    }

    const promotions = await prisma.promotion.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        promoCodeLinks: {
          include: {
            promoCode: {
              select: {
                id: true,
                code: true,
                name: true,
                active: true,
              },
            },
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    return NextResponse.json(promotions);
  } catch (error: any) {
    console.error('Error fetching promotions:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch promotions' },
      { status: 500 }
    );
  }
}

// POST /api/promotions - Create a new promotion
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const name = String(body.name || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const activationMode = body.activationMode?.toUpperCase();
    if (!VALID_MODES.includes(activationMode)) {
      return NextResponse.json(
        { error: 'Invalid activationMode. Must be AUTOMATIC or PROMO_CODE' },
        { status: 400 }
      );
    }

    const status = body.status ? body.status.toUpperCase() : 'DRAFT';
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be DRAFT, ACTIVE, PAUSED, or ARCHIVED' },
        { status: 400 }
      );
    }

    const conditions = parseJsonField(body.conditions, 'conditions', {});
    const benefits = parseJsonField(body.benefits, 'benefits', {});
    const applicationPolicy = parseJsonField(body.applicationPolicy, 'applicationPolicy', {});
    const combinationPolicy = parseJsonField(body.combinationPolicy, 'combinationPolicy', {
      combinable: false,
    });
    const metadata = body.metadata ? parseJsonField(body.metadata, 'metadata', null) : null;

    const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'CLP';
    const startsAt = parseOptionalDate(body.startsAt);
    const endsAt = parseOptionalDate(body.endsAt);
    const priority = parseOptionalInt(body.priority) ?? 0;
    const usageLimit = parseOptionalInt(body.usageLimit);
    const perCustomerLimit = parseOptionalInt(body.perCustomerLimit);
    const description = body.description ? String(body.description).trim() : null;
    const badge = body.badge ? String(body.badge).trim() : null;

    const promoCodeIds: string[] = Array.isArray(body.promoCodeIds)
      ? body.promoCodeIds.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
      : [];

    const created = await prisma.$transaction(async (tx) => {
      const promo = await tx.promotion.create({
        data: {
          name,
          badge,
          description,
          status,
          activationMode,
          conditions,
          benefits,
          applicationPolicy,
          combinationPolicy,
          currency,
          startsAt,
          endsAt,
          priority,
          version: 1,
          usageLimit,
          usageCount: 0,
          perCustomerLimit,
          metadata: metadata ?? undefined,
        },
      });

      if (activationMode === 'PROMO_CODE' && promoCodeIds.length > 0) {
        // Delete existing links for these codes in case they were previously assigned elsewhere
        await tx.promoCodePromotion.deleteMany({
          where: { promoCodeId: { in: promoCodeIds } },
        });

        await tx.promoCodePromotion.createMany({
          data: promoCodeIds.map((pId) => ({
            promoCodeId: pId,
            promotionId: promo.id,
          })),
        });
      }

      return tx.promotion.findUnique({
        where: { id: promo.id },
        include: {
          promoCodeLinks: {
            include: {
              promoCode: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  active: true,
                },
              },
            },
          },
          _count: {
            select: {
              applications: true,
            },
          },
        },
      });
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating promotion:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create promotion' },
      { status: 500 }
    );
  }
}
