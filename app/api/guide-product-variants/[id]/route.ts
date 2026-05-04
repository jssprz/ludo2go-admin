import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/guide-product-variants/[id] - Get a guide's product variants
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const variants = await prisma.guideProductVariant.findMany({
      where: { guideId: id },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(variants);
  } catch (error) {
    console.error('Error fetching guide product variants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guide product variants' },
      { status: 500 }
    );
  }
}

// POST /api/guide-product-variants/[id] - Add a product variant to a guide
export async function POST(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { variantId } = body;

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
        { status: 400 }
      );
    }

    // Check if guide exists
    const guide = await prisma.guide.findUnique({
      where: { id },
    });

    if (!guide) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }

    // Check if variant exists
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 });
    }

    // Check if association already exists
    const existing = await prisma.guideProductVariant.findUnique({
      where: {
        guideId_variantId: { guideId: id, variantId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This variant is already associated with this guide' },
        { status: 400 }
      );
    }

    const association = await prisma.guideProductVariant.create({
      data: {
        guideId: id,
        variantId,
      },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(association, { status: 201 });
  } catch (error) {
    console.error('Error adding guide product variant:', error);
    return NextResponse.json(
      { error: 'Failed to add guide product variant' },
      { status: 500 }
    );
  }
}

// DELETE /api/guide-product-variants/[id]?variantId=... - Remove a product variant from a guide
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const variantId = url.searchParams.get('variantId');

    if (!variantId) {
      return NextResponse.json(
        { error: 'Variant ID is required' },
        { status: 400 }
      );
    }

    const association = await prisma.guideProductVariant.delete({
      where: {
        guideId_variantId: {
          guideId: id,
          variantId,
        },
      },
    });

    return NextResponse.json(association);
  } catch (error) {
    console.error('Error removing guide product variant:', error);
    return NextResponse.json(
      { error: 'Failed to remove guide product variant' },
      { status: 500 }
    );
  }
}
