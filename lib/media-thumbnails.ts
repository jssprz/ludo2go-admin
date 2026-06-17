import 'server-only';

import { put } from '@vercel/blob';
import sharp from 'sharp';

const THUMBNAIL_SIZE = 512;

type CreateThumbnailParams = {
  sourceUrl: string;
  sourceMime?: string | null;
  pathnameHint?: string;
};

type ThumbnailResult = {
  thumbUrl: string;
  width: number | null;
  height: number | null;
};

function sanitizeBaseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'asset';
}

function getFileNameFromUrl(sourceUrl: string): string {
  try {
    const { pathname } = new URL(sourceUrl);
    const filename = pathname.split('/').pop();
    return filename || 'asset';
  } catch {
    return 'asset';
  }
}

function isImageMime(mime?: string | null): boolean {
  if (!mime) return true;
  return mime.startsWith('image/');
}

export async function createAndStoreThumbnailFromUrl({
  sourceUrl,
  sourceMime,
  pathnameHint,
}: CreateThumbnailParams): Promise<ThumbnailResult | null> {
  if (!isImageMime(sourceMime)) {
    return null;
  }

  try {
    const response = await fetch(sourceUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch source image: ${response.status}`);
    }

    const sourceBuffer = Buffer.from(await response.arrayBuffer());

    const source = sharp(sourceBuffer, { animated: true, failOn: 'none' }).rotate();
    const metadata = await source.metadata();

    const thumbBuffer = await source
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    const originalName = pathnameHint || getFileNameFromUrl(sourceUrl);
    const safeBaseName = sanitizeBaseName(originalName);
    const thumbPath = `media/image/thumbs/${Date.now()}-${safeBaseName}.webp`;

    const blob = await put(thumbPath, thumbBuffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'image/webp',
    });

    return {
      thumbUrl: blob.url,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    };
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return null;
  }
}
