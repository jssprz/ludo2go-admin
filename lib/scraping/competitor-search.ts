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

const publisherPrefixes = new Set(['jdm', 'devir', 'asmodee', 'lanae']);
const stopwords = new Set([
  'y', 'e', 'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'en', 'the',
  'of', 'and', 'a', 'juego', 'mesa', 'edicion', 'espanol', 'spanish'
]);

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Drops parentheticals, publisher prefixes and expansion markers ("exp4", "exp.").
function coreWords(value: string) {
  const words = fold(value)
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .filter((word) => !/^(exp|expansion|expansiones)\d*$/.test(word));
  while (words.length > 1 && publisherPrefixes.has(words[0])) words.shift();
  return words;
}

export function nameTokens(value: string) {
  return coreWords(value).filter((word) => !stopwords.has(word));
}

export function nameKey(value: string) {
  return nameTokens(value).join(' ');
}

// Symmetric similarity so a base game never matches its expansion (or vice versa).
export function nameScore(a: string, b: string) {
  const left = new Set(nameTokens(a));
  const right = new Set(nameTokens(b));
  if (!left.size || !right.size) return 0;
  const numbers = (set: Set<string>) =>
    Array.from(set).filter((word) => /\d/.test(word)).sort().join(',');
  if (numbers(left) !== numbers(right)) return 0;
  const shared = Array.from(left).filter((word) => right.has(word)).length;
  return shared / (left.size + right.size - shared);
}

export const nameMatchThreshold = 0.75;

export function slugGuesses(name: string) {
  const words = coreWords(name);
  const slugs = [words.join('-'), nameTokens(name).join('-')].filter(Boolean);
  return Array.from(new Set(slugs));
}

export function searchQueries(name: string) {
  const tokens = nameTokens(name);
  const queries = [tokens.join(' '), tokens.slice(0, 4).join(' ')];
  if (tokens.length > 2) queries.push(tokens.slice(0, 2).join(' '));
  return Array.from(new Set(queries.filter(Boolean)));
}

function slugTitle(url: string) {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
    return decodeURIComponent(last).replace(/-/g, ' ');
  } catch {
    return '';
  }
}

export function pageTitles(html: string) {
  const $ = cheerio.load(html);
  const titles: string[] = [];
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const visit = (value: unknown) => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== 'object') return;
        const object = value as Record<string, unknown>;
        const types = [object['@type']].flat();
        if (types.includes('Product') && typeof object.name === 'string')
          titles.push(object.name);
        if (object['@graph']) visit(object['@graph']);
      };
      visit(JSON.parse($(node).text()));
    } catch {}
  });
  titles.push(
    $('meta[property="og:title"]').attr('content') ?? '',
    $('h1').first().text(),
    $('title').first().text().split(/[|\u2013\u2014]| - /)[0]
  );
  return titles.map((title) => title.replace(/\s+/g, ' ').trim()).filter(Boolean);
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

const slugPaths = ['/product/', '/producto/', '/products/'];

function resultFor(
  store: CompetitorStore,
  url: string,
  html: string
): CompetitorResult {
  return {
    storeId: store.id,
    storeName: store.name,
    url,
    availability: inspectExternalPage(html).availability
  };
}

// Returns null when the store does not appear to carry the product.
// Strategies, cheapest first: EAN search, direct slug guess, fuzzy name search.
export async function findInStore(
  store: CompetitorStore,
  product: Searchable
): Promise<CompetitorResult | null> {
  let origin: string;
  try {
    origin = new URL(store.url).origin;
  } catch {
    return null;
  }
  const ean = eanDigits(product.barcode);
  const titleMatches = (html: string) =>
    pageTitles(html).some(
      (title) => nameScore(title, product.name) >= nameMatchThreshold
    );

  if (ean) {
    for (const searchUrl of searchUrls(store.url, ean)) {
      const html = await fetchPublicHtml(searchUrl);
      if (!html) continue;
      for (const candidate of extractCandidates(html, origin).slice(
        0,
        maxCandidates
      )) {
        const page = await fetchPublicHtml(candidate.url);
        if (!page) continue;
        if (inspectExternalPage(page, { sku: '', barcode: ean }).identityVerified)
          return resultFor(store, candidate.url, page);
      }
    }
  }

  for (const slug of slugGuesses(product.name)) {
    for (const path of slugPaths) {
      const url = `${origin}${path}${slug}${path === '/products/' ? '' : '/'}`;
      const page = await fetchPublicHtml(url);
      if (page && titleMatches(page)) return resultFor(store, url, page);
    }
  }

  const tried = new Set<string>();
  for (const query of searchQueries(product.name)) {
    for (const searchUrl of searchUrls(store.url, query)) {
      const html = await fetchPublicHtml(searchUrl);
      if (!html) continue;
      const ranked = extractCandidates(html, origin)
        .map((candidate) => ({
          ...candidate,
          score: Math.max(
            nameScore(candidate.title, product.name),
            nameScore(slugTitle(candidate.url), product.name)
          )
        }))
        .filter((candidate) => candidate.score >= 0.5 && !tried.has(candidate.url))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCandidates);
      for (const candidate of ranked) {
        tried.add(candidate.url);
        const page = await fetchPublicHtml(candidate.url);
        if (page && titleMatches(page))
          return resultFor(store, candidate.url, page);
      }
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
