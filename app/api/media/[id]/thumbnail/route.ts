import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildUpdateAuditFields, getAdminUserIdFromSession } from '@/lib/admin-audit';
import { createAndStoreThumbnailFromUrl } from '@/lib/media-thumbnails';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/media/[id]/thumbnail - Regenerate thumbnail for an image media asset
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const adminUserId = getAdminUserIdFromSession(session);

  const { id } = await context.params;

  try {
    const media = await prisma.mediaAsset.findUnique({
      where: { id },
      select: {
        id: true,
        kind: true,
        url: true,
        mime: true,
        alt: true,
      },
    });

    if (!media) {
      return NextResponse.json({ message: 'Media not found' }, { status: 404 });
    }

    if (media.kind !== 'image') {
      return NextResponse.json(
        { message: 'Thumbnails are only supported for image assets' },
        { status: 400 }
      );
    }

    const thumbnail = await createAndStoreThumbnailFromUrl({
      sourceUrl: media.url,
      sourceMime: media.mime,
      pathnameHint: media.alt || media.id,
    });

    if (!thumbnail?.thumbUrl) {
      return NextResponse.json(
        { message: 'Unable to generate thumbnail for this image' },
        { status: 422 }
      );
    }

    const updated = await prisma.mediaAsset.update({
      where: { id },
      data: {
        thumbUrl: thumbnail.thumbUrl,
        width: thumbnail.width,
        height: thumbnail.height,
        ...buildUpdateAuditFields(adminUserId),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error generating thumbnail:', error);

    if (error.code === 'P2025') {
      return NextResponse.json({ message: 'Media not found' }, { status: 404 });
    }

    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
