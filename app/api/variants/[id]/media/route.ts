import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { MediaRole } from '@prisma/client';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/variants/[id]/media - Get all media for a variant
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const variantMedia = await prisma.variantMedia.findMany({
      where: { variantId: id },
      include: {
        media: true,
      },
      orderBy: { sort: 'asc' },
    });

    return NextResponse.json(variantMedia);
  } catch (error: any) {
    console.error('Error fetching variant media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST /api/variants/[id]/media - Add media to variant
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

    // Check if variant exists
    const variant = await prisma.productVariant.findUnique({
      where: { id },
    });

    if (!variant) {
      return NextResponse.json(
        { message: 'Variant not found' },
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
    const existing = await prisma.variantMedia.findFirst({
      where: {
        variantId: id,
        mediaId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'Media already attached to this variant' },
        { status: 400 }
      );
    }

    // Get the next sort value if not provided
    let sortValue = sort;
    if (sortValue === undefined || sortValue === null) {
      const maxSort = await prisma.variantMedia.aggregate({
        where: { variantId: id },
        _max: { sort: true },
      });
      sortValue = (maxSort._max.sort ?? -1) + 1;
    }

    // Create the variant media relation
    const variantMedia = await prisma.variantMedia.create({
      data: {
        variantId: id,
        mediaId,
        role: role || null,
        sort: sortValue,
      },
      include: {
        media: true,
      },
    });

    return NextResponse.json(variantMedia, { status: 201 });
  } catch (error: any) {
    console.error('Error adding variant media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PUT /api/variants/[id]/media - Bulk update variant media (reorder, update roles)
export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { media } = body; // Array of { variantMediaId, role, sort }

    if (!Array.isArray(media)) {
      return NextResponse.json(
        { message: 'media array is required' },
        { status: 400 }
      );
    }

    // Update each media item in a transaction
    await prisma.$transaction(
      media.map((item: { variantMediaId: string; role?: MediaRole | null; sort?: number }) =>
        prisma.variantMedia.update({
          where: { id: item.variantMediaId },
          data: {
            role: item.role ?? null,
            sort: item.sort,
          },
        })
      )
    );

    // Fetch updated media
    const updatedMedia = await prisma.variantMedia.findMany({
      where: { variantId: id },
      include: { media: true },
      orderBy: { sort: 'asc' },
    });

    return NextResponse.json(updatedMedia);
  } catch (error: any) {
    console.error('Error updating variant media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/variants/[id]/media - Remove media from variant (expects variantMediaId in query string)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const variantMediaId = searchParams.get('variantMediaId');

  if (!variantMediaId) {
    return NextResponse.json(
      { message: 'variantMediaId query parameter is required' },
      { status: 400 }
    );
  }

  try {
    await prisma.variantMedia.delete({
      where: { id: variantMediaId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing variant media:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Variant media relation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
