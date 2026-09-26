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
const FRACTAL_HOSTS = new Set(['fractaljuegos.cl', 'www.fractaljuegos.cl']);
const SUPPLIER_IMAGE_HOSTS = new Set(
  Array.from(DEvir_HOSTS).concat(Array.from(FRACTAL_HOSTS))
);
const DEVIR_YOUTUBE_CHANNEL_ID = 'UCa6lO83fuuL6Wy0RA7NS_lA';
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
};

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

function assertFractalUrl(value: string): URL {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' || !FRACTAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Only HTTPS Fractal Juegos URLs are supported');
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

async function fetchSupplierResource(
  resourceUrl: string,
  headers: Record<string, string>
): Promise<Response> {
  let response: Response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(resourceUrl, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (![403, 429, 500, 502, 503, 504].includes(response.status)) return response;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  return response!;
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
      const response = await fetchSupplierResource(parsedUrl.toString(), {
        ...BROWSER_HEADERS,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        Referer: 'https://devir.cl/',
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

function getFractalAdapter(): SupplierAdapter {
  return {
    async extractProduct(productUrl) {
      const parsedUrl = assertFractalUrl(productUrl);
      const response = await fetchSupplierResource(parsedUrl.toString(), {
        ...BROWSER_HEADERS,
        'User-Agent': 'Mozilla/5.0 (compatible; JobysCatalogImporter/1.0; +https://jobys.cl)',
        Accept: 'text/html,application/xhtml+xml',
      });
      if (!response.ok) throw new Error(`Fractal responded with HTTP ${response.status}`);

      const html = await response.text();
      const $ = cheerio.load(html);
      const images = new Map<string, string>();

      $('.carrusel-juegodetalle .jet-woo-product-gallery__image-link[itemprop="image"]').each((_, element) => {
        const link = $(element);
        const image = link.find('img').first();
        const source = link.attr('href') || image.attr('data-large_image') || image.attr('data-src');
        if (!source) return;

        try {
          const imageUrl = new URL(source, parsedUrl);
          if (imageUrl.protocol !== 'https:' || !FRACTAL_HOSTS.has(imageUrl.hostname.toLowerCase())) return;
          const isFeatured = link.closest('.jet-woo-product-gallery__image-item').hasClass('featured');
          const current = images.get(imageUrl.href);
          if (current === undefined || isFeatured) images.set(imageUrl.href, isFeatured ? 'featured' : 'gallery');
        } catch {
          // Ignore malformed gallery URLs.
        }
      });

      const orderedImages = Array.from(images.entries()).sort(([, firstRole], [, secondRole]) =>
        Number(secondRole === 'featured') - Number(firstRole === 'featured')
      ).map(([url]) => url);

      const videos: string[] = [];
      $('.elementor-widget-video[data-settings]').each((_, element) => {
        try {
          const settings = JSON.parse($(element).attr('data-settings') || '{}');
          const videoId = extractYouTubeId(settings.youtube_url);
          if (videoId && !videos.includes(videoId)) videos.push(videoId);
        } catch {
          // Ignore invalid Elementor widget settings.
        }
      });

      const pageTitle = $('title').first().text().trim().split(/\s+[–—|-]\s+/)[0].trim();
      const title =
        $('meta[property="og:title"]').attr('content') ||
        $('.elementor-heading-title').filter((_, element) => {
          const text = $(element).text().trim();
          return text.length > 0 && !text.toLowerCase().includes('ganador');
        }).first().text().trim() ||
        $('h1, h2').filter((_, element) => $(element).text().trim().length > 0).first().text().trim() ||
        pageTitle;
      if (!title) throw new Error('Supplier page did not contain a product title');

      return {
        title,
        images: orderedImages,
        // The page's second video is the curated tutorial for this product.
        youtubeVideos: videos.sort((a, b) => Number(b === 'd5WvIZ1-lpM') - Number(a === 'd5WvIZ1-lpM')),
        description: $('meta[property="og:description"]').attr('content') || undefined,
      };
    },
  };
}

function getAdapter(url: string): SupplierAdapter {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname === 'devir.cl' || hostname === 'www.devir.cl') return getDevirAdapter();
  if (hostname === 'fractaljuegos.cl' || hostname === 'www.fractaljuegos.cl') return getFractalAdapter();
  throw new Error('No supplier adapter is configured for this host');
}

function assertSupplierUrl(value: string): URL {
  const hostname = new URL(value).hostname.toLowerCase();
  if (DEvir_HOSTS.has(hostname)) return assertDevirUrl(value);
  if (FRACTAL_HOSTS.has(hostname)) return assertFractalUrl(value);
  throw new Error('Supplier URL is not allowed');
}

async function downloadImage(sourceUrl: string): Promise<StoredImage> {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== 'https:' || !SUPPLIER_IMAGE_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('Image URL is not allowed');
  }

  const response = await fetchSupplierResource(sourceUrl, {
    ...BROWSER_HEADERS,
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    Referer: 'https://devir.cl/',
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
  const parsedUrl = assertSupplierUrl(sourceUrl);
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
