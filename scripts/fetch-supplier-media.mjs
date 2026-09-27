#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 200;
const FETCH_TIMEOUT_MS = 15_000;
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
};
const HOSTS = {
  devir: new Set(['devir.cl', 'www.devir.cl']),
  devirImages: new Set(['devirinvestments.s3.eu-west-1.amazonaws.com']),
  fractal: new Set(['fractaljuegos.cl', 'www.fractaljuegos.cl']),
};

function usage() {
  console.log(`Usage:
  node scripts/fetch-supplier-media.mjs <supplier-url> [output-directory]

Examples:
  node scripts/fetch-supplier-media.mjs https://fractaljuegos.cl/juegos/hula-hula/
  node scripts/fetch-supplier-media.mjs https://devir.cl/trio ./tmp/trio
`);
}

function parseArgs() {
  const [, , sourceUrl, outputDirectory] = process.argv;
  if (!sourceUrl || sourceUrl === '--help' || sourceUrl === '-h') {
    usage();
    process.exit(sourceUrl ? 0 : 1);
  }
  const url = new URL(sourceUrl);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS supplier URLs are supported');
  return { url, outputDirectory: outputDirectory || `./tmp/${productSlug(url)}` };
}

function productSlug(url) {
  const segments = url.pathname.split('/').filter(Boolean);
  const value = segments.at(-1) || 'product';
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';
}

async function fetchResource(url, headers = {}) {
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url, {
      headers: { ...BROWSER_HEADERS, ...headers },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (![403, 429, 500, 502, 503, 504].includes(response.status)) return response;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  return response;
}

async function getYouTubeTitle(videoId) {
  try {
    const response = await fetchResource(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { Accept: 'application/json' }
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    return typeof data.title === 'string' ? data.title : undefined;
  } catch {
    return undefined;
  }
}

function youtubeId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/embed/')[1]?.split('/')[0] || null;
      return url.searchParams.get('v');
    }
  } catch {
    return null;
  }
  return null;
}

function jsonLdProduct($) {
  let product = null;
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
      }) || null;
    } catch {
      // Ignore unrelated JSON-LD blocks.
    }
  });
  return product;
}

function stringValue(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) return stringValue(value[0]);
  if (value && typeof value === 'object' && 'url' in value) return stringValue(value.url);
  return undefined;
}

function parseDevir($, pageUrl) {
  const jsonLd = jsonLdProduct($);
  const images = [];
  $('script[type="text/x-magento-init"]').each((_, element) => {
    try {
      const config = JSON.parse($(element).text());
      const gallery = config['[data-gallery-role=gallery-placeholder]']?.['mage/gallery/gallery']?.data;
      if (!Array.isArray(gallery)) return;
      for (const item of gallery) {
        if (item?.type === 'image' && typeof item.full === 'string') images.push(new URL(item.full, pageUrl).href);
      }
    } catch {
      // Ignore unrelated Magento blocks.
    }
  });
  if (images.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) images.push(new URL(ogImage, pageUrl).href);
  }

  const videos = [];
  for (const kind of ['tutorial', 'trailer']) {
    const embed = $(`#${kind} iframe[src*="youtube.com/embed/"]`).attr('src');
    const id = embed ? youtubeId(embed) : null;
    if (id && !videos.includes(id)) videos.push(id);
  }

  const title = stringValue(jsonLd?.name) || $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim();
  return {
    supplier: 'devir',
    title,
    sku: $('form[data-product-sku]').attr('data-product-sku') || stringValue(jsonLd?.sku),
    ean: stringValue(jsonLd?.gtin13) || stringValue(jsonLd?.gtin),
    description: stringValue(jsonLd?.description) || $('meta[property="og:description"]').attr('content') || undefined,
    images: Array.from(new Set(images)),
    youtubeVideoIds: videos,
  };
}

function parseFractal($, pageUrl) {
  const imageMap = new Map();
  $('.carrusel-juegodetalle .jet-woo-product-gallery__image-link[itemprop="image"]').each((_, element) => {
    const link = $(element);
    const image = link.find('img').first();
    const source = link.attr('href') || image.attr('data-large_image') || image.attr('data-src');
    if (!source) return;
    try {
      const url = new URL(source, pageUrl);
      if (!HOSTS.fractal.has(url.hostname.toLowerCase())) return;
      const featured = link.closest('.jet-woo-product-gallery__image-item').hasClass('featured');
      const existing = imageMap.get(url.href);
      imageMap.set(url.href, {
        url: url.href,
        isMain: Boolean(existing?.isMain || featured),
        width: Number(image.attr('data-large_image_width')) || undefined,
        height: Number(image.attr('data-large_image_height')) || undefined,
      });
    } catch {
      // Ignore malformed gallery URLs.
    }
  });

  const videos = [];
  $('.elementor-widget-video[data-settings]').each((_, element) => {
    try {
      const settings = JSON.parse($(element).attr('data-settings') || '{}');
      const id = youtubeId(settings.youtube_url);
      if (id && !videos.includes(id)) videos.push(id);
    } catch {
      // Ignore invalid Elementor settings.
    }
  });

  const pageTitle = $('title').first().text().trim().split(/\s+[–—|-]\s+/)[0].trim();
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('.elementor-heading-title').filter((_, element) => !$(element).text().toLowerCase().includes('ganador')).first().text().trim() ||
    $('h1, h2').filter((_, element) => $(element).text().trim()).first().text().trim() ||
    pageTitle;

  return {
    supplier: 'fractal',
    title,
    description: $('meta[property="og:description"]').attr('content') || undefined,
    images: Array.from(imageMap.values()).sort((a, b) => Number(b.isMain) - Number(a.isMain)),
    youtubeVideoIds: videos.sort((a, b) => Number(b === 'd5WvIZ1-lpM') - Number(a === 'd5WvIZ1-lpM')),
  };
}

function allowedImageHost(supplier, hostname) {
  return supplier === 'devir'
    ? HOSTS.devir.has(hostname) || HOSTS.devirImages.has(hostname)
    : HOSTS.fractal.has(hostname);
}

async function downloadImage(image, supplier, outputDirectory, slug, index) {
  const sourceUrl = typeof image === 'string' ? image : image.url;
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== 'https:' || !allowedImageHost(supplier, parsed.hostname.toLowerCase())) {
    throw new Error(`Image host is not allowed: ${parsed.hostname}`);
  }

  const response = await fetchResource(sourceUrl, {
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    Referer: supplier === 'devir' ? 'https://devir.cl/' : 'https://fractaljuegos.cl/',
  });
  if (!response.ok) throw new Error(`Image responded HTTP ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Image exceeds the 10 MB limit');
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height || metadata.width < MIN_IMAGE_DIMENSION || metadata.height < MIN_IMAGE_DIMENSION) {
    throw new Error(`Image resolution is below ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION}`);
  }
  if (!['jpeg', 'png', 'webp', 'gif', 'avif', 'heif'].includes(metadata.format)) {
    throw new Error(`Unsupported image format: ${metadata.format || 'unknown'}`);
  }

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format === 'heif' ? 'avif' : metadata.format;
  const filename = `${slug}-${String(index + 1).padStart(2, '0')}-${checksum.slice(0, 12)}.${extension}`;
  const outputPath = path.join(outputDirectory, 'images', filename);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buffer);

  const webpPath = path.join(outputDirectory, 'images', `${slug}-${String(index + 1).padStart(2, '0')}-${checksum.slice(0, 12)}.webp`);
  await sharp(buffer).webp({ quality: 86 }).toFile(webpPath);

  return {
    sourceUrl,
    localFile: path.relative(outputDirectory, outputPath),
    webpFile: path.relative(outputDirectory, webpPath),
    width: metadata.width,
    height: metadata.height,
    mime: `image/${metadata.format === 'jpeg' ? 'jpeg' : metadata.format === 'heif' ? 'avif' : metadata.format}`,
    sizeBytes: buffer.length,
    checksum,
    isMain: typeof image === 'object' ? Boolean(image.isMain) : index === 0,
  };
}

async function main() {
  const { url, outputDirectory } = parseArgs();
  const hostname = url.hostname.toLowerCase();
  const supplier = HOSTS.devir.has(hostname) ? 'devir' : HOSTS.fractal.has(hostname) ? 'fractal' : null;
  if (!supplier) throw new Error(`Unsupported supplier host: ${hostname}`);

  const response = await fetchResource(url.href, {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    Referer: `${url.origin}/`,
  });
  if (!response.ok) throw new Error(`${supplier} responded HTTP ${response.status}`);

  const $ = cheerio.load(await response.text());
  const product = supplier === 'devir' ? parseDevir($, url.href) : parseFractal($, url.href);
  if (!product.title) throw new Error('Supplier page did not contain a product title');

  await fs.mkdir(outputDirectory, { recursive: true });
  const images = [];
  const errors = [];
  const slug = productSlug(url);
  for (let index = 0; index < product.images.length; index += 1) {
    try {
      images.push(await downloadImage(product.images[index], supplier, outputDirectory, slug, index));
    } catch (error) {
      errors.push({ sourceUrl: typeof product.images[index] === 'string' ? product.images[index] : product.images[index].url, error: error.message });
    }
  }

  const videos = [];
  for (const videoId of product.youtubeVideoIds) {
    videos.push({
      videoId,
      title: await getYouTubeTitle(videoId),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      providerOwned: supplier === 'devir',
    });
  }

  const manifest = {
    ...product,
    slug,
    sourceUrl: url.href,
    fetchedAt: new Date().toISOString(),
    images,
    videos,
    errors,
  };
  await fs.writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Fetched ${product.title}`);
  console.log(`Images saved: ${images.length}/${product.images.length}`);
  console.log(`YouTube videos found: ${product.youtubeVideoIds.length}`);
  console.log(`Output: ${path.resolve(outputDirectory)}`);
  if (errors.length) console.warn(`Images skipped: ${errors.length}`);
}

main().catch((error) => {
  console.error(`Import failed: ${error.message}`);
  process.exitCode = 1;
});
