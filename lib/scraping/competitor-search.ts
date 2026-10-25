import * as cheerio from 'cheerio';
import {
  fetchPublicHtml,
  inspectExternalPage
} from './external-stock';
import type { Availability } from './supplier-catalog';

export type CompetitorStore = { id: string; name: string; url: string };
export type CompetitorResult = {
  storeId: string;
  storeName: string;
  url: string;
  availability: Availability;
};
type Searchable = { name: string; barcode: string | null };

const productLink =
  'a[href*="/products/"], a[href*="/producto/"], a[href*="/product/"]';
const maxCandidates = 3;

function nameKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function eanDigits(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

export function searchUrls(storeUrl: string, query: string) {
  const origin = new URL(storeUrl).origin;
  const encoded = encodeURIComponent(query);
  return [
    `${origin}/search?q=${encoded}`,
    `${origin}/?s=${encoded}&post_type=product`
  ];
}

export function extractCandidates(html: string, origin: string) {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const candidates: { url: string; title: string }[] = [];
  $(productLink).each((_, node) => {
    const href = $(node).attr('href');
    if (!href) return;
    let url: URL;
    try {
      url = new URL(href, origin);
    } catch {
      return;
    }
    url.hash = '';
    url.search = '';
    if (url.origin !== origin || seen.has(url.href)) return;
    const title = (
      $(node).attr('title') ||
      $(node).text() ||
      $(node).find('img').attr('alt') ||
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    seen.add(url.href);
    candidates.push({ url: url.href, title });
  });
  return candidates;
}

// Returns null when the store does not appear to carry the product.
export async function findInStore(
  store: CompetitorStore,
  product: Searchable
): Promise<CompetitorResult | null> {
  const ean = eanDigits(product.barcode);
  let origin: string;
  try {
    origin = new URL(store.url).origin;
  } catch {
    return null;
  }
  for (const searchUrl of searchUrls(store.url, ean ?? product.name)) {
    const html = await fetchPublicHtml(searchUrl);
    if (!html) continue;
    let candidates = extractCandidates(html, origin);
    if (!ean) {
      const wanted = nameKey(product.name);
      candidates = candidates.filter(
        (candidate) => nameKey(candidate.title) === wanted
      );
    }
    for (const candidate of candidates.slice(0, maxCandidates)) {
      const page = await fetchPublicHtml(candidate.url);
      if (!page) continue;
      const inspected = inspectExternalPage(
        page,
        ean ? { sku: '', barcode: ean } : undefined
      );
      if (!inspected.identityVerified) continue;
      return {
        storeId: store.id,
        storeName: store.name,
        url: candidate.url,
        availability: inspected.availability
      };
    }
  }
  return null;
}

export async function findInStores(
  stores: CompetitorStore[],
  product: Searchable
) {
  const results = await Promise.all(
    stores.map((store) => findInStore(store, product))
  );
  return results.filter((result): result is CompetitorResult => result !== null);
}

// A new-product opportunity needs at least one store carrying it, all out of stock.
export function isNewProductOpportunity(results: { availability: string }[]) {
  return (
    results.length > 0 &&
    results.every((result) => result.availability === 'out_of_stock')
  );
}
