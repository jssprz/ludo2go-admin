import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string; groupId: string }> };

// GET /api/bundles/[id]/groups/[groupId]/options
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;

  try {
    const options = await prisma.customizableBundleOption.findMany({
      where: { groupId },
      orderBy: { sortOrder: 'asc' },
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
    return NextResponse.json(options);
  } catch (error) {
    console.error('Error fetching options:', error);
    return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 });
  }
}

// POST /api/bundles/[id]/groups/[groupId]/options
export async function POST(req: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { groupId } = await params;
  const body = await req.json();

  const { label, description, variantId, priceDelta, metadata, sortOrder, active } = body;

  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }

  try {
    const option = await prisma.customizableBundleOption.create({
      data: {
        groupId,
        label,
        description: description ?? null,
        variantId: variantId ?? null,
        priceDelta: priceDelta ?? 0,
        metadata: metadata ?? undefined,
        sortOrder: sortOrder ?? 0,
        active: active ?? true,
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
    return NextResponse.json(option, { status: 201 });
  } catch (error) {
    console.error('Error creating option:', error);
    return NextResponse.json({ error: 'Failed to create option' }, { status: 500 });
  }
}
