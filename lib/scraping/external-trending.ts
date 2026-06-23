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
  brand?: string | null; // e.g. "Fractal Juegos"
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

const BRAND_FETCH_TIMEOUT_MS = 12000;
const BRAND_FETCH_RETRIES = 2;
const BRAND_FETCH_CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      if (currentIndex >= items.length) return;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: safeLimit }, () => worker()));
  return results;
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
    storeName: 'Demente games',
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
            brand: null,
          });
        }
      });
      return products;
    },
  },
  {
    key: 'magicsur',
    storeName: 'magicsur',
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
            brand: null,
          });
        }
      });
      return products;
    },
  },
  {
    key: 'updown',
    storeName: 'Updown',
    url: 'https://www.updown.cl/categoria-producto/juegos-de-mesa/?orderby=popularity&paged=1',
    parse($) {
      const products: TrendingProduct[] = [];
      // WooCommerce + Woodmart theme
      $('.wd-product.product-grid-item').each((i, el) => {
        const $el = $(el);
        const name =
          $el.find('h3.wd-entities-title a').text().trim() ||
          $el.find('h2.wd-entities-title a').text().trim();
        const url =
          $el.find('.product-image-link').attr('href') ||
          $el.find('h3.wd-entities-title a').attr('href') || '';
        const imageUrl =
          $el.find('.product-image-link noscript img').attr('src') ||
          $el.find('.product-image-link img').attr('data-lazy-src') ||
          $el.find('.product-image-link img').attr('src') || null;
        // WooCommerce sale markup usually stores old price in <del> and discounted price in <ins>.
        const salePriceText = $el.find('.price ins .woocommerce-Price-amount.amount').first().text();
        const regularPriceText = $el.find('.price del .woocommerce-Price-amount.amount').first().text();
        const fallbackPriceText = $el.find('.price .woocommerce-Price-amount.amount').first().text();
        const priceText = salePriceText || fallbackPriceText;
        const originalPriceText = regularPriceText || null;
        const badge =
          $el.find('.onsale.product-label').first().text().trim() || null;

        if (name && url) {
          products.push({
            rank: i + 1,
            name,
            url: url.startsWith('http') ? url : `https://www.updown.cl${url}`,
            imageUrl,
            price: normalizePriceText(priceText),
            originalPrice: normalizePriceText(originalPriceText),
            currency: 'CLP',
            badge,
            brand: null,
          });
        }
      });
      return products;
    },
  },
  {
    key: 'antartica',
    storeName: 'Antartica',
    url: 'https://www.antartica.cl/juegos-y-accesorios/entretencion/juegos.html?product_list_order=bestseller&product_list_dir=desc',
    parse($) {
      const products: TrendingProduct[] = [];
      // Magento-like product grid
      $('li.product-item').each((i, el) => {
        const $el = $(el);
        const link = $el.find('.product-item-name .product-item-link').first();
        const name = link.text().trim();
        const url = link.attr('href') || '';
        const imageUrl =
          $el.find('img.product-image-photo').first().attr('src') ||
          $el.find('img.product-image-photo').first().attr('data-src') ||
          null;

        const salePriceText = $el.find('.price-box .special-price .price').first().text();
        const fallbackPriceText =
          $el.find('.price-box .price-container .price').first().text() ||
          $el.find('.price-box .price').first().text();
        const originalPriceText =
          $el.find('.price-box .old-price .price').first().text() ||
          $el.find('.price-box .regular-price .price').first().text();
        const badge =
          $el.find('.product-label, .label, .sale, .discount').first().text().trim() || null;
        const brand =
          $el.find('a[href*="autor="]').first().text().trim() ||
          $el.find('.product.author a').first().text().trim() ||
          null;

        if (name && url) {
          products.push({
            rank: i + 1,
            name,
            url: url.startsWith('http') ? url : `https://www.antartica.cl${url}`,
            imageUrl,
            price: normalizePriceText(salePriceText || fallbackPriceText),
            originalPrice: normalizePriceText(originalPriceText),
            currency: 'CLP',
            badge,
            brand,
          });
        }
      });
      return products;
    },
  },
];

// ─── Fetch brand from product detail page ────────────────────
async function fetchProductBrand(url: string): Promise<string | null> {
  for (let attempt = 0; attempt <= BRAND_FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BRAND_FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
        },
        next: { revalidate: 0 },
        signal: controller.signal,
      });

      if (!res.ok) {
        // Retry transient upstream issues; fail fast on hard client errors.
        if (res.status >= 500 || res.status === 429) {
          continue;
        }
        return null;
      }

      const html = await res.text();
      const $ = cheerio.load(html);

      // Try multiple selectors for brand on product detail page
      // For updown: <li>Marca:Devir</li> inside <div class="woocommerce-product-details__short-description"><ul><li>
      // For dementegames: <div class="product-manufacturer" itemprop="brand"><meta itemprop="name" content="Fractal Juegos">
      // For magicsur: <div class="product-manufacturer-next img alt="...">

      // UpDown: extract from "Marca:" in short description
      let brand =
        $('.woocommerce-product-details__short-description li')
          .toArray()
          .map((el) => $(el).text())
          .find((text) => text.toLowerCase().startsWith('marca:'))
          ?.replace(/^marca:\s*/i, '')
          ?.trim() || null;

      // If not found via updown method, try other stores
      if (!brand) {
        brand =
          $('.product-manufacturer meta[itemprop="name"]').attr('content') ||
          $('meta[itemprop="brand"]').attr('content') ||
          $('[itemprop="brand"]').first().text().trim() ||
          $('.product-manufacturer-next img').attr('alt')?.trim() ||
          $('.product-manufacturer a img').attr('alt')?.trim() ||
          $('.product-manufacturer img').attr('alt')?.trim() ||
          $('.product-manufacturer').first().text().trim() ||
          $('.manufacturer').first().text().trim() ||
          $('[class*="brand"]').first().text().trim() || null;
      }

      return brand && brand.length > 0 ? brand : null;
    } catch {
      if (attempt >= BRAND_FETCH_RETRIES) {
        return null;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

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

    // Fetch brand from each product's detail page
    const productsWithBrands = await mapWithConcurrency(
      products,
      BRAND_FETCH_CONCURRENCY,
      async (product) => {
        const brand = await fetchProductBrand(product.url);
        return { ...product, brand: brand ?? product.brand ?? null };
      }
    );

    return {
      key: config.key,
      storeName: config.storeName,
      url: config.url,
      products: productsWithBrands,
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
