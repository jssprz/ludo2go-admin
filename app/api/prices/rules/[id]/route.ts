import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';

import { auth } from '@/lib/auth';
import {
  buildUpdateAuditFields,
  getAdminUserIdFromSession,
} from '@/lib/admin-audit';
import {
  buildVariantPriceRuleData,
  unapplyVariantPriceRule,
} from '@/lib/pricing/variant-price-rules';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminUserId = getAdminUserIdFromSession(session);
    const { id } = await context.params;
    const payload = await request.json();
    const data = buildVariantPriceRuleData(payload);

    const updated = await prisma.variantPriceRule.update({
      where: { id },
      data: {
        ...data,
        ...buildUpdateAuditFields(adminUserId),
      },
      include: {
        _count: {
          select: {
            prices: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating price rule:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update price rule' },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminUserId = getAdminUserIdFromSession(session);
    const { id } = await context.params;

    await unapplyVariantPriceRule(id, adminUserId).catch(() => ({ deletedPrices: 0 }));

    await prisma.variantPriceRule.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting price rule:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete price rule' },
      { status: 500 }
    );
  }
}
