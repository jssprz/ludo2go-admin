/**
 * Scrapes all store paths from the database and inserts fresh observed prices.
 *
 * Run with:
 *   node scrape-prices.js
 *
 * Requirements:
 *   npm install @prisma/client playwright
 *   npx playwright install
 */

const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// =============== Price extractors per store ===============
const PRICE_SELECTORS = {
  'www.wargaming.cl': ['.bs-product__final-price'],
  'www.gatoarcano.cl': [
    'p.price :not(del) .woocommerce-Price-amount bdi',
    'p.price :not(del) .woocommerce-Price-amount',
    'p.price :not(del) .price'
  ],
  'www.magicsur.cl': [
    '.product-prices .current-price .product-price.current-price-value'
  ],
  'www.updown.cl': [
    'p.price :not(del) .woocommerce-Price-amount bdi',
    'p.price :not(del) .woocommerce-Price-amount',
    'p.price :not(del) .price'
  ],
  'buhojuegosdemesa.cl': [
    '#ProductPrice-product-template'
  ],
  'dementegames.cl': [
    '.product-prices .product-price .current-price span'
  ],
  'www.entrejuegos.cl': [
    '.product-prices .product-price .current-price .current-price-value'
  ],
  'www.m4e.cl': [
    '.product-form_price'
  ],
  'www.vudugaming.cl': [
    '.product-price .product-page__price'
  ],
  'revaruk.cl': [
    '.product .price .amount bdi'
  ],
  'ludopalooza.cl': [
    '.price-item.price-item--regular'
  ],
  'area52.cl': [
    '.price-item.price-item--regular'
  ],
};

function normalizePriceText(text) {
  let t = String(text || '').trim();
  t = t.replace(/[^\d.,]/g, '').replace(/\u00A0/g, ' ');

  // CLP logic: treat "." or "," followed by 3 digits as thousands separator
  if (/\.\d{3}(?!\d)/.test(t) && !/,/.test(t)) {
    t = t.replace(/\./g, '');
  } else if (/,\d{3}(?!\d)/.test(t) && !/\./.test(t)) {
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
    } else {
      t = t.replace(/[.,\s]/g, '');
    }
  }
  const num = Number(t);
  return Number.isNaN(num) ? null : Math.round(num);
}

// =============== Main scraping logic ===============
async function scrapePrice(page, url) {
  const hostname = new URL(url).hostname.toLowerCase();
  const selectors = PRICE_SELECTORS[hostname] || ['.price', '[itemprop=price]', '.woocommerce-Price-amount'];

  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.count()) {
        const text = (await el.textContent())?.trim();
        const price = normalizePriceText(text);
        if (price != null) {
          return { price, selector: sel };
        }
      }
    } catch {
      // continue
    }
  }
  return { price: null, selector: null };
}

async function main() {
  console.log('🔍 Fetching store URLs...');
  // Example: join ItemPriceInStore with Store to get URL paths
  const items = await prisma.itemPriceInStore.findMany({
    include: { store: true, variant: true },
  });

  if (!items.length) {
    console.log('⚠️ No scrapped prices found in DB.');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: 'PriceBot/1.0 (+contact@example.com)' });
  const page = await ctx.newPage();

  for (const item of items) {
    const base = item.store.url.replace(/\/$/, '');
    const fullUrl = base + item.urlPathInStore;

    console.log(`🛒 Scraping ${item.store.name}: ${fullUrl}`);

    try {
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const { price, selector } = await scrapePrice(page, fullUrl);

      if (price != null) {
        console.log(`✅ ${item.store.name} ${item.variantId}: ${price} CLP (selector: ${selector})`);

        await prisma.itemPriceInStore.create({
          data: {
            variantId: item.variantId,
            storeId: item.storeId,
            urlPathInStore: item.urlPathInStore,
            observedPrice: price,
            currency: 'CLP',
            observedAt: new Date(),
          },
        });
      } else {
        console.log(`⚠️ Price not found for ${fullUrl}`);
      }
    } catch (err) {
      console.error(`❌ Error scraping ${fullUrl}:`, err.message);
    }
  }

  await browser.close();
  await prisma.$disconnect();
  console.log('✅ Scraping complete.');
}

// Run
main().catch((e) => {
  console.error('Fatal error:', e);
  prisma.$disconnect();
  process.exit(1);
});
