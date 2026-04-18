import * as cheerio from 'cheerio';

export interface TrendingProduct {
  rank: number;
  name: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  originalPrice: number | null;
  currency: string;
  badge: string | null; // e.g. "Nuevo", "Oferta", "-20%"
}

export interface TrendingSource {
  key: string;
  storeName: string;
  url: string;
  products: TrendingProduct[];
  scrapedAt: string; // ISO date
  error?: string;
}

interface SiteConfig {
  key: string;
  storeName: string;
  url: string;
  /** Extract product list from cheerio-loaded HTML */
  parse: ($: cheerio.CheerioAPI) => TrendingProduct[];
}

// ─── Price parsing ─────────────────────────────────────────────
function normalizePriceText(text: string | undefined | null): number | null {
  if (!text) return null;
  let t = text.trim().replace(/[^\d.,]/g, '').replace(/\u00A0/g, '');
  // CLP: "." is thousands separator, no decimals
  if (/\.\d{3}(?!\d)/.test(t) && !/,/.test(t)) {
    t = t.replace(/\./g, '');
  } else if (/,\d{3}(?!\d)/.test(t) && !/\./.test(t)) {
    t = t.replace(/,/g, '');
  } else {
    t = t.replace(/[.,\s]/g, '');
  }
  const num = Number(t);
  return Number.isNaN(num) ? null : Math.round(num);
}

// ─── Site configs (PrestaShop-based) ───────────────────────────
const SITES: SiteConfig[] = [
  {
    key: 'dementegames',
    storeName: 'Demente Games',
    url: 'https://dementegames.cl/10-juegos-de-mesa?order=product.sales.desc',
    parse($) {
      const products: TrendingProduct[] = [];
      // PrestaShop product list
      $('article.product-miniature, .js-product-miniature').each((i, el) => {
        const $el = $(el);
        const name =
          $el.find('.product-title a, h2.product-title a, .h3.product-title a').text().trim() ||
          $el.find('a.product-title').text().trim();
        const url =
          $el.find('.product-title a, a.product-title').attr('href') ||
          $el.find('.thumbnail a, .product-thumbnail a').attr('href') || '';
        const imageUrl =
          $el.find('img.product-thumbnail-first, .product-thumbnail img, img').first().attr('data-full-size-image-url') ||
          $el.find('img.product-thumbnail-first, .product-thumbnail img, img').first().attr('src') || null;
        const priceText = $el.find('.product-price-and-shipping .price, .price').first().text();
        const originalPriceText = $el.find('.product-price-and-shipping .regular-price').text();
        const badge =
          $el.find('.product-flag, .discount-percentage, .new, .on-sale').first().text().trim() || null;

        if (name) {
          products.push({
            rank: i + 1,
            name,
            url: url.startsWith('http') ? url : `https://dementegames.cl${url}`,
            imageUrl,
            price: normalizePriceText(priceText),
            originalPrice: normalizePriceText(originalPriceText),
            currency: 'CLP',
            badge,
          });
        }
      });
      return products;
    },
  },
  {
    key: 'magicsur',
    storeName: 'MagicSur',
    url: 'https://www.magicsur.cl/15-juegos-de-mesa-magicsur-chile?order=product.sales.desc',
    parse($) {
      const products: TrendingProduct[] = [];
      $('article.product-miniature, .js-product-miniature').each((i, el) => {
        const $el = $(el);
        const name =
          $el.find('.product-title a, h2.product-title a, .h3.product-title a').text().trim() ||
          $el.find('a.product-title').text().trim();
        const url =
          $el.find('.product-title a, a.product-title').attr('href') ||
          $el.find('.thumbnail a, .product-thumbnail a').attr('href') || '';
        const imageUrl =
          $el.find('img.product-thumbnail-first, .product-thumbnail img, img').first().attr('data-full-size-image-url') ||
          $el.find('img.product-thumbnail-first, .product-thumbnail img, img').first().attr('src') || null;
        const priceText = $el.find('.product-price-and-shipping .price, .price').first().text();
        const originalPriceText = $el.find('.product-price-and-shipping .regular-price').text();
        const badge =
          $el.find('.product-flag, .discount-percentage, .new, .on-sale').first().text().trim() || null;

        if (name) {
          products.push({
            rank: i + 1,
            name,
            url: url.startsWith('http') ? url : `https://www.magicsur.cl${url}`,
            imageUrl,
            price: normalizePriceText(priceText),
            originalPrice: normalizePriceText(originalPriceText),
            currency: 'CLP',
            badge,
          });
        }
      });
      return products;
    },
  },
];

// ─── Fetch + parse one site ────────────────────────────────────
async function scrapeSite(config: SiteConfig): Promise<TrendingSource> {
  try {
    const res = await fetch(config.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return {
        key: config.key,
        storeName: config.storeName,
        url: config.url,
        products: [],
        scrapedAt: new Date().toISOString(),
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const products = config.parse($);

    return {
      key: config.key,
      storeName: config.storeName,
      url: config.url,
      products,
      scrapedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      key: config.key,
      storeName: config.storeName,
      url: config.url,
      products: [],
      scrapedAt: new Date().toISOString(),
      error: err.message || 'Unknown error',
    };
  }
}

// ─── Public API ────────────────────────────────────────────────
export async function scrapeAllTrending(): Promise<TrendingSource[]> {
  const results = await Promise.all(SITES.map(scrapeSite));
  return results;
}

export function getTrendingSiteConfigs() {
  return SITES.map((s) => ({ key: s.key, storeName: s.storeName, url: s.url }));
}
