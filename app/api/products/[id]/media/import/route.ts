import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildCreateAuditFields, getAdminUserIdFromSession } from '@/lib/admin-audit';
import { importSupplierMedia } from '@/lib/supplier-media-import';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: productId } = await context.params;
  const adminUserId = getAdminUserIdFromSession(session);

  try {
    const body = await request.json();
    const sourceUrl = typeof body?.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
    if (!sourceUrl) {
      return NextResponse.json({ message: 'sourceUrl is required' }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ message: 'Product not found' }, { status: 404 });
    }

    const imported = await importSupplierMedia(sourceUrl);
    const existingRelations = await prisma.productMedia.findMany({
      where: { productId },
      select: { mediaId: true },
    });
    const attachedIds = new Set(existingRelations.map((relation) => relation.mediaId));
    let nextSort = (await prisma.productMedia.aggregate({
      where: { productId },
      _max: { sort: true },
    }))._max.sort ?? -1;
    const addedImages: string[] = [];
    const addedVideos: string[] = [];

    for (const image of imported.storedImages) {
      let media = await prisma.mediaAsset.findUnique({ where: { checksum: image.checksum } });
      if (!media) {
        media = await prisma.mediaAsset.create({
          data: {
            kind: 'image',
            url: image.url,
            thumbUrl: image.thumbUrl,
            width: image.width,
            height: image.height,
            sizeBytes: image.sizeBytes,
            mime: image.mime,
            alt: imported.product.title,
            copyright: imported.sourceUrl,
            checksum: image.checksum,
            ...buildCreateAuditFields(adminUserId),
          },
        });
      }

      if (!attachedIds.has(media.id)) {
        nextSort += 1;
        await prisma.productMedia.create({
          data: {
            productId,
            mediaId: media.id,
            role: addedImages.length === 0 ? 'primary' : 'gallery',
            sort: nextSort,
          },
        });
        attachedIds.add(media.id);
        addedImages.push(media.id);
      }
    }

    for (const videoId of imported.youtubeVideoIds) {
      const url = youtubeWatchUrl(videoId);
      let media = await prisma.mediaAsset.findFirst({
        where: { kind: 'video', url },
      });
      if (!media) {
        media = await prisma.mediaAsset.create({
          data: {
            kind: 'video',
            url,
            thumbUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            mime: 'text/html',
            alt: `${imported.product.title} video`,
            copyright: imported.officialYouTubeChannelId,
            ...buildCreateAuditFields(adminUserId),
          },
        });
      }

      if (!attachedIds.has(media.id)) {
        nextSort += 1;
        await prisma.productMedia.create({
          data: {
            productId,
            mediaId: media.id,
            role: 'gallery',
            sort: nextSort,
          },
        });
        attachedIds.add(media.id);
        addedVideos.push(videoId);
      }
    }

    return NextResponse.json({
      sourceUrl: imported.sourceUrl,
      title: imported.product.title,
      sku: imported.product.sku,
      imagesFound: imported.product.images.length,
      imagesAdded: addedImages.length,
      videosFound: imported.youtubeVideoIds.length,
      videosAdded: addedVideos.length,
      youtubeVideoIds: addedVideos,
      errors: imported.errors,
    });
  } catch (error: any) {
    console.error('Supplier media import failed:', error);
    return NextResponse.json(
      { message: error.message || 'Supplier media import failed' },
      { status: 400 }
    );
  }
}
