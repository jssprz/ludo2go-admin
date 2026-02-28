import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { MediaRole } from '@prisma/client';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/products/[id]/media - Get all media for a product
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const productMedia = await prisma.productMedia.findMany({
      where: { productId: id },
      include: {
        media: true,
      },
      orderBy: { sort: 'asc' },
    });

    return NextResponse.json(productMedia);
  } catch (error: any) {
    console.error('Error fetching product media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/media - Add media to product
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { mediaId, role, sort } = body;

    if (!mediaId) {
      return NextResponse.json(
        { message: 'mediaId is required' },
        { status: 400 }
      );
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if media exists
    const media = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
    });

    if (!media) {
      return NextResponse.json(
        { message: 'Media not found' },
        { status: 404 }
      );
    }

    // Check if the relation already exists
    const existing = await prisma.productMedia.findUnique({
      where: {
        productId_mediaId: {
          productId: id,
          mediaId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'Media already attached to this product' },
        { status: 400 }
      );
    }

    // Get the next sort value if not provided
    let sortValue = sort;
    if (sortValue === undefined || sortValue === null) {
      const maxSort = await prisma.productMedia.aggregate({
        where: { productId: id },
        _max: { sort: true },
      });
      sortValue = (maxSort._max.sort ?? -1) + 1;
    }

    // Create the product media relation
    const productMedia = await prisma.productMedia.create({
      data: {
        productId: id,
        mediaId,
        role: role || null,
        sort: sortValue,
      },
      include: {
        media: true,
      },
    });

    return NextResponse.json(productMedia, { status: 201 });
  } catch (error: any) {
    console.error('Error adding product media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id]/media - Bulk update product media (reorder, update roles)
export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { media } = body; // Array of { mediaId, role, sort }

    if (!Array.isArray(media)) {
      return NextResponse.json(
        { message: 'media array is required' },
        { status: 400 }
      );
    }

    // Update each media item in a transaction
    await prisma.$transaction(
      media.map((item: { mediaId: string; role?: MediaRole | null; sort?: number }) =>
        prisma.productMedia.update({
          where: {
            productId_mediaId: {
              productId: id,
              mediaId: item.mediaId,
            },
          },
          data: {
            role: item.role ?? null,
            sort: item.sort,
          },
        })
      )
    );

    // Fetch updated media
    const updatedMedia = await prisma.productMedia.findMany({
      where: { productId: id },
      include: { media: true },
      orderBy: { sort: 'asc' },
    });

    return NextResponse.json(updatedMedia);
  } catch (error: any) {
    console.error('Error updating product media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id]/media - Remove media from product (expects mediaId in query string)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const mediaId = searchParams.get('mediaId');

  if (!mediaId) {
    return NextResponse.json(
      { message: 'mediaId query parameter is required' },
      { status: 400 }
    );
  }

  try {
    await prisma.productMedia.delete({
      where: {
        productId_mediaId: {
          productId: id,
          mediaId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing product media:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Product media relation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
