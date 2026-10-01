import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
const VALID_MODES = ['AUTOMATIC', 'PROMO_CODE'] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

// GET /api/promotions/[id] - Get single promotion
export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const promotion = await prisma.promotion.findUnique({
      where: { id },
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

    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    return NextResponse.json(promotion);
  } catch (error: any) {
    console.error('Error fetching promotion:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch promotion' },
      { status: 500 }
    );
  }
}

// PUT /api/promotions/[id] - Update a promotion
export async function PUT(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.promotion.findUnique({
      where: { id },
      include: {
        promoCodeLinks: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    const body = await request.json();

    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    if (!name) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    const status = body.status !== undefined ? body.status.toUpperCase() : existing.status;
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const activationMode = body.activationMode !== undefined
      ? body.activationMode.toUpperCase()
      : existing.activationMode;
    if (activationMode && !VALID_MODES.includes(activationMode)) {
      return NextResponse.json({ error: 'Invalid activationMode' }, { status: 400 });
    }

    const conditions = body.conditions !== undefined
      ? parseJsonField(body.conditions, 'conditions', {})
      : existing.conditions;

    const benefits = body.benefits !== undefined
      ? parseJsonField(body.benefits, 'benefits', {})
      : existing.benefits;

    const applicationPolicy = body.applicationPolicy !== undefined
      ? parseJsonField(body.applicationPolicy, 'applicationPolicy', {})
      : existing.applicationPolicy;

    const combinationPolicy = body.combinationPolicy !== undefined
      ? parseJsonField(body.combinationPolicy, 'combinationPolicy', { combinable: false })
      : existing.combinationPolicy;

    const metadata = body.metadata !== undefined
      ? (body.metadata ? parseJsonField(body.metadata, 'metadata', null) : null)
      : existing.metadata;

    const currency = body.currency !== undefined
      ? String(body.currency).trim()
      : existing.currency;

    const startsAt = body.startsAt !== undefined ? parseOptionalDate(body.startsAt) : existing.startsAt;
    const endsAt = body.endsAt !== undefined ? parseOptionalDate(body.endsAt) : existing.endsAt;
    const priority = body.priority !== undefined ? (parseOptionalInt(body.priority) ?? 0) : existing.priority;
    const usageLimit = body.usageLimit !== undefined ? parseOptionalInt(body.usageLimit) : existing.usageLimit;
    const perCustomerLimit = body.perCustomerLimit !== undefined ? parseOptionalInt(body.perCustomerLimit) : existing.perCustomerLimit;
    const description = body.description !== undefined
      ? (body.description ? String(body.description).trim() : null)
      : existing.description;

    // Check if business rules changed to increment version
    const rulesChanged =
      JSON.stringify(conditions) !== JSON.stringify(existing.conditions) ||
      JSON.stringify(benefits) !== JSON.stringify(existing.benefits) ||
      JSON.stringify(applicationPolicy) !== JSON.stringify(existing.applicationPolicy) ||
      JSON.stringify(combinationPolicy) !== JSON.stringify(existing.combinationPolicy) ||
      activationMode !== existing.activationMode ||
      currency !== existing.currency;

    const nextVersion = rulesChanged ? existing.version + 1 : existing.version;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.promotion.update({
        where: { id },
        data: {
          name,
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
          version: nextVersion,
          usageLimit,
          perCustomerLimit,
          metadata: metadata ?? undefined,
        },
      });

      // Synchronize promoCodeLinks if promoCodeIds is passed
      if (body.promoCodeIds !== undefined) {
        if (activationMode === 'AUTOMATIC') {
          // Remove any linked codes
          await tx.promoCodePromotion.deleteMany({
            where: { promotionId: id },
          });
        } else if (activationMode === 'PROMO_CODE') {
          const promoCodeIds: string[] = Array.isArray(body.promoCodeIds)
            ? body.promoCodeIds.filter((p: unknown) => typeof p === 'string' && p.trim().length > 0)
            : [];

          // Remove links no longer in promoCodeIds
          await tx.promoCodePromotion.deleteMany({
            where: {
              promotionId: id,
              promoCodeId: { notIn: promoCodeIds },
            },
          });

          if (promoCodeIds.length > 0) {
            // Delete links for these promo codes pointing to other promotions (since promoCodeId is unique)
            await tx.promoCodePromotion.deleteMany({
              where: {
                promoCodeId: { in: promoCodeIds },
                promotionId: { not: id },
              },
            });

            // Find which are already linked to this promotion
            const currentLinks = await tx.promoCodePromotion.findMany({
              where: { promotionId: id },
              select: { promoCodeId: true },
            });
            const currentIds = new Set(currentLinks.map((l) => l.promoCodeId));
            const newToAdd = promoCodeIds.filter((pId) => !currentIds.has(pId));

            if (newToAdd.length > 0) {
              await tx.promoCodePromotion.createMany({
                data: newToAdd.map((pId) => ({
                  promoCodeId: pId,
                  promotionId: id,
                })),
              });
            }
          }
        }
      }

      return tx.promotion.findUnique({
        where: { id },
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

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating promotion:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update promotion' },
      { status: 500 }
    );
  }
}

// DELETE /api/promotions/[id] - Delete a promotion
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    await prisma.promotion.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Promotion deleted' });
  } catch (error: any) {
    console.error('Error deleting promotion:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete promotion' },
      { status: 500 }
    );
  }
}
