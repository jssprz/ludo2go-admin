import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getAdminUserIdFromSession } from '@/lib/admin-audit';
import { unapplyVariantPriceRule } from '@/lib/pricing/variant-price-rules';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const adminUserId = getAdminUserIdFromSession(session);
    const { id } = await context.params;
    const result = await unapplyVariantPriceRule(id, adminUserId);

    return NextResponse.json({
      ok: true,
      deletedPrices: result.deletedPrices,
    });
  } catch (error: any) {
    console.error('Error unapplying price rule:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to unapply price rule' },
      { status: 500 }
    );
  }
}
