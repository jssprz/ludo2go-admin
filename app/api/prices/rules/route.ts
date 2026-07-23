import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';

import { auth } from '@/lib/auth';
import {
  buildCreateAuditFields,
  getAdminUserIdFromSession,
} from '@/lib/admin-audit';
import { buildVariantPriceRuleData } from '@/lib/pricing/variant-price-rules';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rules = await prisma.variantPriceRule.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        _count: {
          select: {
            prices: true,
          },
        },
      },
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error listing price rules:', error);
    return NextResponse.json(
      { error: 'Failed to list price rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminUserId = getAdminUserIdFromSession(session);
    const payload = await request.json();
    const data = buildVariantPriceRuleData(payload);

    const created = await prisma.variantPriceRule.create({
      data: {
        ...data,
        ...buildCreateAuditFields(adminUserId),
      },
      include: {
        _count: {
          select: {
            prices: true,
          },
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error('Error creating price rule:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create price rule' },
      { status: 400 }
    );
  }
}
