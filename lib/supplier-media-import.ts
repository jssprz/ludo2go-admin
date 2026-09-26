import 'server-only';

import crypto from 'node:crypto';
import { put } from '@vercel/blob';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 200;
const FETCH_TIMEOUT_MS = 15_000;
const DEvir_HOSTS = new Set([
  'devir.cl',
  'www.devir.cl',
  'devirinvestments.s3.eu-west-1.amazonaws.com',
]);
const DEVIR_YOUTUBE_CHANNEL_ID = 'UCa6lO83fuuL6Wy0RA7NS_lA';

type SupplierAdapter = {
  extractProduct(url: string): Promise<ExtractedSupplierProduct>;
};

type ExtractedSupplierProduct = {
  title: string;
  sku?: string;
  ean?: string;
  pvp?: number;
  images: string[];
  youtubeVideos: string[];
  description?: string;
};

type StoredImage = {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  mime: string;
  sizeBytes: number;
  checksum: string;
};

function assertDevirUrl(value: string): URL {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || !DEvir_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Only HTTPS Devir Chile URLs are supported');
  }
  return parsed;
}

function absoluteUrl(value: string, baseUrl: string): string | null {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractYouTubeId(value: string): string | null {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || null;
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) return null;
    if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.slice(7).split('/')[0] || null;
    return parsed.searchParams.get('v');
  } catch {
    return null;
  }
}

function getJsonLdProduct($: cheerio.CheerioAPI) {
  let product: Record<string, any> | null = null;
  $('script[type="application/ld+json"]').each((_, element) => {
    if (product) return;
    try {
      const parsed = JSON.parse($(element).text());
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.['@graph'])
          ? parsed['@graph']
          : [parsed];
      product = candidates.find((item) => {
        const type = item?.['@type'];
        return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
      }) ?? null;
    } catch {
      // Ignore unrelated or malformed JSON-LD blocks.
    }
  });
  return product;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) return firstString(value[0]);
  if (value && typeof value === 'object' && 'url' in value) {
    return firstString((value as { url?: unknown }).url);
  }
  return undefined;
}

function getDevirAdapter(): SupplierAdapter {
  return {
    async extractProduct(productUrl) {
      const parsedUrl = assertDevirUrl(productUrl);
      const response = await fetch(parsedUrl, {
        headers: {
          'User-Agent': 'JobysCatalogImporter/1.0',
          Accept: 'text/html',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Devir responded with HTTP ${response.status}`);

      const html = await response.text();
      const $ = cheerio.load(html);
      const jsonLd = getJsonLdProduct($) as Record<string, any> | null;
      const images: string[] = [];

      $('script[type="text/x-magento-init"]').each((_, element) => {
        try {
          const config = JSON.parse($(element).text());
          const gallery = config['[data-gallery-role=gallery-placeholder]']?.['mage/gallery/gallery']?.data;
          if (!Array.isArray(gallery)) return;
          for (const item of gallery) {
            const image = item?.type === 'image' ? item.full : null;
            if (typeof image === 'string') images.push(new URL(image, parsedUrl).toString());
          }
        } catch {
          // Ignore unrelated Magento initialization blocks.
        }
      });

      const ogImage = $('meta[property="og:image"]').attr('content');
      if (images.length === 0 && ogImage) images.push(new URL(ogImage, parsedUrl).toString());

      const youtubeVideos: string[] = [];
      for (const kind of ['tutorial', 'trailer']) {
        const embedUrl = $(`#${kind} iframe[src*="youtube.com/embed/"]`).attr('src');
        const videoId = embedUrl ? extractYouTubeId(embedUrl) : null;
        if (videoId && !youtubeVideos.includes(videoId)) youtubeVideos.push(videoId);
      }

      const sku = $('form[data-product-sku]').attr('data-product-sku') ||
        firstString(jsonLd?.sku) || firstString(jsonLd?.gtin13) || undefined;
      const title = firstString(jsonLd?.name) || $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim();
      if (!title) throw new Error('Supplier page did not contain a product title');

      const price = firstString(jsonLd?.offers?.price);
      return {
        title,
        sku,
        ean: firstString(jsonLd?.gtin13) || firstString(jsonLd?.gtin),
        pvp: price ? Number(price.replace(',', '.')) : undefined,
        images: Array.from(new Set(images)),
        youtubeVideos,
        description: firstString(jsonLd?.description) || $('meta[property="og:description"]').attr('content') || undefined,
      };
    },
  };
}

function getAdapter(url: string): SupplierAdapter {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname === 'devir.cl' || hostname === 'www.devir.cl') return getDevirAdapter();
  throw new Error('No supplier adapter is configured for this host');
}

async function downloadImage(sourceUrl: string): Promise<StoredImage> {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== 'https:' || !DEvir_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Image URL is not allowed');
  }

  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'JobysCatalogImporter/1.0', Accept: 'image/*' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Image download failed with HTTP ${response.status}`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error('Image exceeds the 10 MB limit');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('Image exceeds the 10 MB limit');
  const image = sharp(buffer, { failOn: 'error' });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width < MIN_IMAGE_DIMENSION || metadata.height < MIN_IMAGE_DIMENSION) {
    throw new Error('Image resolution is below 200 x 200 pixels');
  }
  if (!metadata.format || !['jpeg', 'png', 'webp', 'gif', 'avif'].includes(metadata.format)) {
    throw new Error('Unsupported image format');
  }

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const mime = metadata.format === 'jpeg' ? 'image/jpeg' : `image/${metadata.format}`;
  const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
  const originalName = parsed.pathname.split('/').pop() || 'supplier-image';
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
    url: blob.url,
    thumbUrl: thumbBlob.url,
    width: metadata.width,
    height: metadata.height,
    mime,
    sizeBytes: buffer.byteLength,
    checksum,
  };
}

export async function importSupplierMedia(sourceUrl: string) {
  const parsedUrl = assertDevirUrl(sourceUrl);
  const product = await getAdapter(parsedUrl.toString()).extractProduct(parsedUrl.toString());
  const storedImages: StoredImage[] = [];
  const seenChecksums = new Set<string>();
  const errors: string[] = [];

  for (const imageUrl of product.images) {
    try {
      const stored = await downloadImage(imageUrl);
      if (!seenChecksums.has(stored.checksum)) {
        storedImages.push(stored);
        seenChecksums.add(stored.checksum);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Image import failed');
    }
  }

  return {
    product,
    sourceUrl: parsedUrl.toString(),
    storedImages,
    youtubeVideoIds: product.youtubeVideos.filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id)),
    officialYouTubeChannelId: DEVIR_YOUTUBE_CHANNEL_ID,
    errors,
  };
}
