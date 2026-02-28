import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { del } from '@vercel/blob';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/media/[id] - Get single media asset
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const media = await prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        productRefs: {
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
        variantRefs: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!media) {
      return NextResponse.json(
        { message: 'Media not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(media);
  } catch (error: any) {
    console.error('Error fetching media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PATCH /api/media/[id] - Update media asset metadata
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { alt, copyright, locale } = body;

    const media = await prisma.mediaAsset.update({
      where: { id },
      data: {
        ...(alt !== undefined && { alt }),
        ...(copyright !== undefined && { copyright }),
        ...(locale !== undefined && { locale }),
      },
    });

    return NextResponse.json(media);
  } catch (error: any) {
    console.error('Error updating media:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Media not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE /api/media/[id] - Delete media asset
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    // Get the media asset first to check references and get URL
    const media = await prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            productRefs: true,
            variantRefs: true,
          },
        },
      },
    });

    if (!media) {
      return NextResponse.json(
        { message: 'Media not found' },
        { status: 404 }
      );
    }

    // Check if media is in use
    const totalRefs = media._count.productRefs + media._count.variantRefs;
    if (totalRefs > 0) {
      return NextResponse.json(
        {
          message: `Cannot delete media that is in use by ${totalRefs} product(s)/variant(s). Remove references first.`,
        },
        { status: 400 }
      );
    }

    // Delete from Vercel Blob (only if it's a Vercel Blob URL)
    if (media.url.includes('blob.vercel-storage.com')) {
      try {
        await del(media.url);
      } catch (blobError) {
        console.error('Error deleting from blob storage:', blobError);
        // Continue with database deletion even if blob deletion fails
      }
    }

    // Delete from database
    await prisma.mediaAsset.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting media:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { message: 'Media not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
