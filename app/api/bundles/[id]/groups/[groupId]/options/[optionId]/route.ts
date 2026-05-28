import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string; groupId: string; optionId: string }> };

// PUT /api/bundles/[id]/groups/[groupId]/options/[optionId]
export async function PUT(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { optionId } = await params;
  const body = await req.json();

  const { label, description, variantId, priceDelta, metadata, sortOrder, active } = body;

  try {
    const option = await prisma.customizableBundleOption.update({
      where: { id: optionId },
      data: {
        ...(label !== undefined ? { label } : {}),
        description: description !== undefined ? (description || null) : undefined,
        variantId: variantId !== undefined ? (variantId || null) : undefined,
        ...(priceDelta !== undefined ? { priceDelta } : {}),
        metadata: metadata !== undefined ? metadata : undefined,
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(active !== undefined ? { active } : {}),
      },
      include: {
        variant: { select: { id: true, sku: true, product: { select: { name: true } } } },
        mediaLinks: {
          orderBy: { sort: 'asc' },
          include: {
            media: {
              select: {
                id: true,
                kind: true,
                url: true,
                thumbUrl: true,
                alt: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(option);
  } catch (error) {
    console.error('Error updating option:', error);
    return NextResponse.json({ error: 'Failed to update option' }, { status: 500 });
  }
}

// DELETE /api/bundles/[id]/groups/[groupId]/options/[optionId]
export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { optionId } = await params;

  try {
    await prisma.customizableBundleOption.delete({ where: { id: optionId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting option:', error);
    return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 });
  }
}
