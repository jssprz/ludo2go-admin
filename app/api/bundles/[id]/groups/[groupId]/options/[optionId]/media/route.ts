import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string; groupId: string; optionId: string }>;
};

const optionInclude = {
  variant: {
    select: {
      id: true,
      sku: true,
      product: { select: { name: true } },
    },
  },
  mediaLinks: {
    orderBy: { sort: 'asc' as const },
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
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { optionId } = await params;

  try {
    const body = await request.json();
    const { mediaId, role, sort } = body;

    if (!mediaId) {
      return NextResponse.json({ message: 'mediaId is required' }, { status: 400 });
    }

    const [option, media] = await Promise.all([
      prisma.customizableBundleOption.findUnique({ where: { id: optionId } }),
      prisma.mediaAsset.findUnique({ where: { id: mediaId } }),
    ]);

    if (!option) {
      return NextResponse.json({ message: 'Option not found' }, { status: 404 });
    }

    if (!media) {
      return NextResponse.json({ message: 'Media not found' }, { status: 404 });
    }

    if (media.kind !== 'image') {
      return NextResponse.json({ message: 'Only image media can be attached to bundle options' }, { status: 400 });
    }

    const existing = await prisma.customizableBundleOptionMedia.findUnique({
      where: {
        optionId_mediaId: {
          optionId,
          mediaId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ message: 'Media already attached to this option' }, { status: 400 });
    }

    let sortValue = sort;
    if (sortValue === undefined || sortValue === null) {
      const maxSort = await prisma.customizableBundleOptionMedia.aggregate({
        where: { optionId },
        _max: { sort: true },
      });
      sortValue = (maxSort._max.sort ?? -1) + 1;
    }

    await prisma.customizableBundleOptionMedia.create({
      data: {
        optionId,
        mediaId,
        role: role || null,
        sort: sortValue,
      },
    });

    const updatedOption = await prisma.customizableBundleOption.findUnique({
      where: { id: optionId },
      include: optionInclude,
    });

    return NextResponse.json(updatedOption, { status: 201 });
  } catch (error: any) {
    console.error('Error attaching option media:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { optionId } = await params;
  const { searchParams } = new URL(request.url);
  const mediaId = searchParams.get('mediaId');

  if (!mediaId) {
    return NextResponse.json({ message: 'mediaId query parameter is required' }, { status: 400 });
  }

  try {
    await prisma.customizableBundleOptionMedia.delete({
      where: {
        optionId_mediaId: {
          optionId,
          mediaId,
        },
      },
    });

    const updatedOption = await prisma.customizableBundleOption.findUnique({
      where: { id: optionId },
      include: optionInclude,
    });

    return NextResponse.json(updatedOption);
  } catch (error: any) {
    console.error('Error removing option media:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ message: 'Option media relation not found' }, { status: 404 });
    }

    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}