import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { buildCreateAuditFields, getAdminUserIdFromSession } from '@/lib/admin-audit';
import { importSupplierMedia } from '@/lib/supplier-media-import';
import crypto from 'node:crypto';
import path from 'node:path';
import { put } from '@vercel/blob';
import sharp from 'sharp';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function createMediaFromManifestImage(file: File, title: string, adminUserId: string | null) {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB limit`);
  const image = sharp(buffer, { failOn: 'error' });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width < 200 || metadata.height < 200) {
    throw new Error(`${file.name} is below the 200 x 200 resolution minimum`);
  }
  if (!metadata.format || !['jpeg', 'png', 'webp', 'gif', 'avif', 'heif'].includes(metadata.format)) {
    throw new Error(`${file.name} is not a supported image format`);
  }

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format === 'heif' ? 'avif' : metadata.format;
  const mime = `image/${metadata.format === 'jpeg' ? 'jpeg' : metadata.format === 'heif' ? 'avif' : metadata.format}`;
  const blob = await put(`media/imported/${checksum}.${extension}`, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: mime,
  });
  const thumbnail = await image.resize(512, 512, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const thumbBlob = await put(`media/image/thumbs/${checksum}.webp`, thumbnail, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'image/webp',
  });

  return {
    kind: 'image' as const,
    url: blob.url,
    thumbUrl: thumbBlob.url,
    width: metadata.width,
    height: metadata.height,
    sizeBytes: buffer.length,
    mime,
    alt: title,
    checksum,
    ...buildCreateAuditFields(adminUserId),
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id: productId } = await context.params;
  const adminUserId = getAdminUserIdFromSession(session);

  try {
    const contentType = request.headers.get('content-type') || '';
    let body: any;
    let manifestFiles = new Map<string, File>();

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const manifestFile = formData.get('manifest');
      if (!(manifestFile instanceof File)) {
        return NextResponse.json({ message: 'manifest.json is required' }, { status: 400 });
      }
      body = JSON.parse(await manifestFile.text());
      for (const entry of formData.getAll('images')) {
        if (entry instanceof File) {
          manifestFiles.set(entry.name, entry);
          const relativePath = (entry as File & { webkitRelativePath?: string }).webkitRelativePath;
          if (relativePath) manifestFiles.set(relativePath, entry);
        }
      }
    } else {
      body = await request.json();
    }

    if (contentType.includes('multipart/form-data')) {
      const title = typeof body?.title === 'string' && body.title ? body.title : 'Imported product media';
      const existingRelations = await prisma.productMedia.findMany({ where: { productId }, select: { mediaId: true } });
      const attachedIds = new Set(existingRelations.map((relation) => relation.mediaId));
      let nextSort = (await prisma.productMedia.aggregate({ where: { productId }, _max: { sort: true } }))._max.sort ?? -1;
      const errors: string[] = [];
      let imagesAdded = 0;
      let videosAdded = 0;

      for (const [index, imageEntry] of (body.images || []).entries()) {
        try {
          const preferredFile = imageEntry.webpFile || imageEntry.localFile;
          const file = manifestFiles.get(preferredFile) || manifestFiles.get(path.basename(preferredFile));
          if (!file) throw new Error(`File not selected: ${preferredFile}`);
          const imageData = await createMediaFromManifestImage(file, title, adminUserId);
          let media = await prisma.mediaAsset.findUnique({ where: { checksum: imageData.checksum } });
          if (!media) media = await prisma.mediaAsset.create({ data: imageData });
          if (!attachedIds.has(media.id)) {
            nextSort += 1;
            await prisma.productMedia.create({ data: { productId, mediaId: media.id, role: index === 0 ? 'primary' : 'gallery', sort: nextSort } });
            attachedIds.add(media.id);
            imagesAdded += 1;
          }
        } catch (error: any) {
          errors.push(error.message || `Failed to import ${imageEntry.localFile}`);
        }
      }

      for (const video of body.videos || []) {
        const videoId = typeof video?.videoId === 'string' ? video.videoId : '';
        if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) continue;
        const url = typeof video?.embedUrl === 'string' && video.embedUrl
          ? video.embedUrl
          : youtubeWatchUrl(videoId);
        let media = await prisma.mediaAsset.findFirst({ where: { kind: 'video', url } });
        if (!media) {
          media = await prisma.mediaAsset.create({ data: { kind: 'video', url, thumbUrl: video.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, mime: 'text/html', alt: typeof video?.title === 'string' && video.title ? video.title : `${title} video`, copyright: video.providerOwned ? body.supplier : 'curated supplier video', ...buildCreateAuditFields(adminUserId) } });
        }
        if (!attachedIds.has(media.id)) {
          nextSort += 1;
          await prisma.productMedia.create({ data: { productId, mediaId: media.id, role: 'gallery', sort: nextSort } });
          attachedIds.add(media.id);
          videosAdded += 1;
        }
      }

      return NextResponse.json({ title, imagesAdded, videosAdded, errors });
    }

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
