import * as cheerio from 'cheerio';
import { prisma } from '@jssprz/ludo2go-database';
import { PriceCurrency } from '@prisma/client';

type TemplateConfig = {
  name: string;
  selectors: string[];
  locale: string;
  readAttrIfMeta?: string;
};

const TEMPLATES: Record<string, TemplateConfig[]> = {
  // Common WooCommerce defaults (tried if no exact hostname match or if match fails)
  __woocommerce_defaults__: [
    {
      name: 'woocommerce-amount-bdi',
      selectors: [
        '.summary .price ins .amount bdi',
        '.summary .price > span.amount bdi',
        '.product .price ins .amount bdi',
        '.product .price > span.amount bdi',
        'p.price ins .woocommerce-Price-amount bdi',
        'p.price > span.woocommerce-Price-amount bdi'
      ],
      locale: 'es-CL'
    },
    {
      name: 'woocommerce-amount',
      selectors: [
        '.summary .price ins .amount',
        '.summary .price > span.amount',
        '.product .price ins .amount',
        '.product .price > span.amount',
        'p.price ins .woocommerce-Price-amount',
        'p.price > span.woocommerce-Price-amount'
      ],
      locale: 'es-CL'
    },
    {
      name: 'generic-price',
      selectors: [
        'meta[itemprop="price"]',
        '[itemprop="price"]',
        '.price'
      ],
      locale: 'es-CL',
      // When using a meta tag, read content attribute
      readAttrIfMeta: 'content'
    }
  ],

  // Host-specific mappings (exact hostname keys, lowercase)
  // Just used as fallbacks if JSON-LD and common woocommerce defaults fail
  'www.wargaming.cl': [
    {
      name: 'wargaming',
      selectors: ['.bs-product__final-price'],
      locale: 'es-CL'
    }
  ],
  'www.magicsur.cl': [
    {
      name: 'magicsur',
      // Example: <div class="product-prices js-product-prices"><div class="product-reference"><div class=""><div><span class="current-price"><span class="product-price current-price-value" content="49990">$49.990</span></span></div></div></div>
      selectors: [
        '.product-prices .current-price .product-price.current-price-value'
      ],
      locale: 'es-CL'
    }
  ],
  'www.updown.cl': [
    {
      name: 'updown-woocommerce',
      // Example: <p class="price woobt-price-162547"><span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol">$</span>29.990</bdi></span></p>
      selectors: [
        'p.price ins .woocommerce-Price-amount bdi',
        'p.price > span.woocommerce-Price-amount bdi',
        'p.price ins .woocommerce-Price-amount',
        'p.price > span.woocommerce-Price-amount'
      ],
      locale: 'es-CL'
    }
  ],
  'www.m4e.cl': [
    {
      name: 'm4e',
      selectors: [
        '.product-form_price'
      ],
      locale: 'es-CL'
    }
  ],
  'dementegames.cl': [
    {
      name: 'dementegames',
      selectors: [
        '.product-prices .product-price .current-price span'
      ],
      locale: 'es-CL'
    }
  ],
  'www.vudugaming.cl': [
    {
      name: 'vudugaming',
      selectors: ['.product-price .product-page__price'],
      locale: 'es-CL'
    }
  ],
  'www.gatoarcano.cl': [
    {
      name: 'gato-arcano-woocommerce',
      // When discounted: <del>old price</del> <ins>sale price</ins>
      // When regular:    <span class="woocommerce-Price-amount">price</span>
      selectors: [
        'p.price ins .woocommerce-Price-amount bdi',
        'p.price > span.woocommerce-Price-amount bdi',
        'p.price ins .woocommerce-Price-amount',
        'p.price > span.woocommerce-Price-amount'
      ],
      locale: 'es-CL'
    }
  ],
  'www.entrejuegos.cl': [
    {
      name: 'entrejuegos',
      selectors: [
        '.product-prices .product-price .current-price .current-price-value'
      ],
      locale: 'es-CL'
    }
  ],
  'www.lafortalezapuq.cl': [
    {
      name: 'lafortaleza',
      selectors: [
        '.price.product-price'
      ],
      locale: 'es-CL'
    }
  ],
  'juegosenroque.cl': [
    {
      name: 'juegosenroque',
      selectors: [
        '.price .price__current'
      ],
      locale: 'es-CL'
    }
  ],
  'area52.cl': [
    {
      name: 'area52',
      selectors: [
        '.price-item.price-item--regular'
      ],
      locale: 'es-CL'
    }
  ],
  'www.gamehousecoyhaique.cl': [
    {
      name: 'gamehousecoyhaique',
      selectors: [
        '.bs-product__final-price'
      ],
      locale: 'es-CL'
    }
  ],
  'www.labovedadelmago.cl': [
    {
      name: 'labovedadelmago',
      selectors: [
        '.summary .price ins .amount bdi',
        '.summary .price > span.amount bdi',
        '.summary .price .amount bdi'
      ],
      locale: 'es-CL'
    }
  ],
  'www.laguaridadeldragon.cl': [
    {
      name: 'laguaridadeldragon',
      selectors: [
        '.bs-product__final-price'
      ],
      locale: 'es-CL'
    }
  ],
  'www.ludipuerto.cl': [
    {
      name: 'ludipuerto',
      selectors: [
        '.summary .price .amount bdi'
      ],
      locale: 'es-CL'
    }
  ],
  'ludopalooza.cl': [
    {
      name: 'ludopalooza',
      selectors: [
        '.price-item.price-item--regular'
      ],
      locale: 'es-CL'
    }
  ],
  'www.aldeajuegos.cl': [
    {
      name: 'aldeajuegos',
      selectors: [
        '.current-price-value'
      ],
      locale: 'es-CL'
    }
  ],
  'tcglifestore.cl': [
    {
      name: 'tcglifestore',
      selectors: [
        '.product .price .amount bdi'
      ],
      locale: 'es-CL'
    }
  ],
  'revaruk.cl': [
    {
      name: 'revaruk',
      selectors: [
        'p.price ins .woocommerce-Price-amount bdi, p.price > span.woocommerce-Price-amount bdi'
      ],
      locale: 'es-CL'
    }
  ],
  'mangaigames.cl': [
    {
      name: 'mangaigames',
      selectors: [
        '.summary .price ins .amount bdi',
        '.summary .price > span.amount bdi',
        '.summary .price .amount bdi'
      ],
      locale: 'es-CL'
    }
  ],
  'buhojuegosdemesa.cl': [
    {
      name: 'buhojuegosdemesa',
      // Example: <span id="ProductPrice-product-template" class="product-single__price" itemprop="price" content="47000.0">$47.000</span>
      selectors: [
        '#ProductPrice-product-template'
      ],
      locale: 'es-CL'
    }
  ],
};

async function tryJsonLd($: cheerio.CheerioAPI) {
  try {
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      const raw = $(scripts[i]).html();
      if (!raw) continue;
      const candidates: any[] = [];
      try {
        const parsed = JSON.parse(raw.trim());
        if (Array.isArray(parsed)) candidates.push(...parsed);
        else candidates.push(parsed);
      } catch {
        const parts = raw.split(/\n(?=\s*\{|\s*\[)/).map((s: string) => s.trim());
        for (const p of parts) {
          try { candidates.push(JSON.parse(p)); } catch { }
        }
      }
      for (const obj of candidates) {
        const offer = findOffer(obj);
        if (offer?.price) {
          const price = normalizePriceText(String(offer.price), 'es-CL');
          return { price, currency: offer.priceCurrency || guessCurrencyFromText(String(offer.price)) };
        }
      }
    }
  } catch { }
  return null;
}

function findOffer(node: any): any {
  if (!node || typeof node !== 'object') return null;
  if (node.offers) {
    if (Array.isArray(node.offers)) {
      return node.offers.find((o: any) => o.price) || node.offers[0];
    }
    return node.offers;
  }
  for (const v of Object.values(node)) {
    const child = findOffer(v);
    if (child) return child;
  }
  return null;
}

function guessCurrencyFromText(text: string) {
  if (text.includes('$')) return 'CLP';
  if (/USD|US\$/.test(text)) return 'USD';
  if (/€/.test(text)) return 'EUR';
  return null;
}

function normalizePriceText(text: string, locale = 'es-CL') {
  let t = String(text).trim();
  t = t.replace(/[^\d.,\s-]/g, '');
  t = t.replace(/\u00A0/g, ' ');
  const thousandsLikeDot = /\.\d{3}(?!\d)/;
  const thousandsLikeComma = /,\d{3}(?!\d)/;
  if (thousandsLikeDot.test(t) && !/,/.test(t)) {
    t = t.replace(/\./g, '');
  } else if (thousandsLikeComma.test(t) && !/\./.test(t)) {
    t = t.replace(/,/g, '');
  } else {
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    let decimalSep = null;
    if (lastComma > lastDot && lastComma !== -1 && /\d{1,2}$/.test(t.slice(lastComma + 1))) {
      decimalSep = ',';
    } else if (lastDot > lastComma && lastDot !== -1 && /\d{1,2}$/.test(t.slice(lastDot + 1))) {
      decimalSep = '.';
    }
    if (decimalSep) {
      const thousandsSep = decimalSep === ',' ? '.' : ',';
      t = t.split(thousandsSep).join('');
      t = t.replace(decimalSep, '.');
    }
  }
  t = t.replace(/\s/g, '');
  const num = Number(t);
  return Number.isNaN(num) ? null : num;
}

function extractWithTemplates($: cheerio.CheerioAPI, hostname: string) {
  const hostTemplates = TEMPLATES[hostname] ?? [];
  const candidates = [
    ...hostTemplates,
    ...TEMPLATES.__woocommerce_defaults__,
  ];

  for (const tpl of candidates) {
    for (const sel of tpl.selectors) {
      try {
        const el = $(sel).first();
        if (!el.length) continue;

        if (tpl.readAttrIfMeta) {
          const content = el.attr(tpl.readAttrIfMeta);
          if (content) {
            const price = normalizePriceText(content, tpl.locale);
            if (price != null) {
              const currency = guessCurrencyFromText(content) || 'CLP';
              return { source: tpl.name, selector: sel, price, currency };
            }
          }
        } else {
          const text = el.text()?.trim();
          if (text) {
            const price = normalizePriceText(text, tpl.locale);
            if (price != null) {
              const currency = guessCurrencyFromText(text) || 'CLP';
              return { source: tpl.name, selector: sel, price, currency };
            }
          }
        }
      } catch { }
    }
  }

  return null;
}

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function scrapePrice(url: string) {
  const u = new URL(url);
  const hostname = u.hostname.toLowerCase();

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-CL,es;q=0.9,en;q=0.5',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // 1. Try JSON-LD structured data first
  const jsonld = await tryJsonLd($);
  if (jsonld?.price != null) {
    return { url, hostname, price: jsonld.price, currency: jsonld.currency || 'CLP', method: 'json-ld' };
  }

  // 2. Try template-based CSS selectors
  const fromTpl = extractWithTemplates($, hostname);
  if (fromTpl) {
    return { url, hostname, price: fromTpl.price, currency: fromTpl.currency, method: `template:${fromTpl.source}`, selector: fromTpl.selector };
  }

  return { url, hostname, price: null, currency: null, method: 'not-found' };
}

export async function scrapeAndInsertExternalPrice(variantId: string, url: string) {
  if (!variantId || !url) {
    throw new Error('variantId and url are required');
  }

  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  const store = await prisma.store.findFirst({
    where: { url: { contains: hostname } },
  });

  if (!store) {
    console.error(`Store not found for hostname ${hostname}. Create a Store entry first.`);
    throw new Error(`Store not found for hostname ${hostname}`);
  }

  const urlPathInStore = parsed.pathname + (parsed.search || '');

  const result = await scrapePrice(url); // <- your existing function

  if (result.price == null) {
    console.error('Price not found, inserted price -1 into DB.');
    await prisma.itemPriceInStore.create({
      data: {
        variantId,
        storeId: store.id,
        urlPathInStore,
        observedPrice: -1,
        currency: (result.currency || 'CLP') as PriceCurrency,
        observedAt: new Date(),
      },
    });
    throw new Error('Price not found');
  }

  await prisma.itemPriceInStore.create({
    data: {
      variantId,
      storeId: store.id,
      urlPathInStore,
      observedPrice: result.price,
      currency: (result.currency || 'CLP') as PriceCurrency,
      observedAt: new Date(),
    },
  });

  console.log('Inserted observed price into DB.');

  return result; // so caller can show it if needed
}