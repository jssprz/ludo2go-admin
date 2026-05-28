import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string; groupId: string }> };

// GET /api/bundles/[id]/groups/[groupId]/rule
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;

  try {
    const rule = await prisma.customizableBundleVariantSelectionRule.findUnique({
      where: { groupId },
    });
    if (!rule) return NextResponse.json(null);
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error fetching rule:', error);
    return NextResponse.json({ error: 'Failed to fetch rule' }, { status: 500 });
  }
}

// PUT /api/bundles/[id]/groups/[groupId]/rule – Upsert variant selection rule
export async function PUT(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;
  const body = await req.json();

  const {
    productKind,
    productStatus,
    variantStatus,
    requireStock,
    requireActivePrice,
    allowedProductIds,
    excludedProductIds,
    allowedVariantIds,
    excludedVariantIds,
    allowedTags,
    excludedTags,
    metadata,
  } = body;

  const data = {
    productKind: productKind ?? null,
    productStatus: productStatus ?? null,
    variantStatus: variantStatus ?? null,
    requireStock: requireStock ?? true,
    requireActivePrice: requireActivePrice ?? true,
    allowedProductIds: allowedProductIds ?? [],
    excludedProductIds: excludedProductIds ?? [],
    allowedVariantIds: allowedVariantIds ?? [],
    excludedVariantIds: excludedVariantIds ?? [],
    allowedTags: allowedTags ?? [],
    excludedTags: excludedTags ?? [],
    metadata: metadata ?? undefined,
  };

  try {
    const rule = await prisma.customizableBundleVariantSelectionRule.upsert({
      where: { groupId },
      create: { groupId, ...data },
      update: data,
    });
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error upserting rule:', error);
    return NextResponse.json({ error: 'Failed to save rule' }, { status: 500 });
  }
}

// DELETE /api/bundles/[id]/groups/[groupId]/rule
export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;

  try {
    await prisma.customizableBundleVariantSelectionRule.delete({ where: { groupId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting rule:', error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
