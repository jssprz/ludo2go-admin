import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildUpdateAuditFields, getAdminUserIdFromSession } from '@/lib/admin-audit';
import { createAndStoreThumbnailFromUrl } from '@/lib/media-thumbnails';

// POST /api/media/thumbnails - Generate thumbnails for existing uploaded images
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const adminUserId = getAdminUserIdFromSession(session);

  try {
    const body = await request.json().catch(() => ({}));
    const onlyMissing = body.onlyMissing !== false;
    const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 500);

    const assets = await prisma.mediaAsset.findMany({
      where: {
        kind: 'image',
        ...(onlyMissing ? { OR: [{ thumbUrl: null }, { thumbUrl: '' }, { thumbUrl: { equals: prisma.mediaAsset.fields.url } }] } : {}),
      },
      select: {
        id: true,
        url: true,
        mime: true,
        alt: true,
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    let generated = 0;
    const failedIds: string[] = [];

    for (const asset of assets) {
      const thumbnail = await createAndStoreThumbnailFromUrl({
        sourceUrl: asset.url,
        sourceMime: asset.mime,
        pathnameHint: asset.alt || asset.id,
      });

      if (!thumbnail?.thumbUrl) {
        failedIds.push(asset.id);
        continue;
      }

      await prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          thumbUrl: thumbnail.thumbUrl,
          width: thumbnail.width,
          height: thumbnail.height,
          ...buildUpdateAuditFields(adminUserId),
        },
      });

      generated += 1;
    }

    return NextResponse.json({
      scanned: assets.length,
      generated,
      failed: failedIds.length,
      failedIds,
      onlyMissing,
      limit,
    });
  } catch (error: any) {
    console.error('Error generating thumbnails in bulk:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
