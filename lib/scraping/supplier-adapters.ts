import * as cheerio from 'cheerio';
import {
  parseClp,
  supplierProductIdentity,
  validateSupplierRun,
  type SupplierProduct,
  type TaxTreatment
} from './supplier-catalog';
import {
  SupplierError,
  SupplierSession,
  type SupplierIntegration
} from './supplier-session';

function field(value: unknown, path: string): unknown {
  return path
    .split('.')
    .filter(Boolean)
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      value
    );
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : typeof value === 'number'
      ? String(value)
      : null;
}
function quantity(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function baseProduct(
  supplierId: string,
  config: SupplierIntegration
): SupplierProduct {
  const treatments: Record<SupplierIntegration['kind'], TaxTreatment> = {
    asmodee: 'unconfirmed',
    devir: 'vat_included',
    lanae: 'excluding_vat'
  };
  return {
    supplierId,
    supplierProductId: '',
    name: '',
    sku: null,
    barcode: null,
    url: '',
    categories: [],
    availability: 'unknown',
    purchasePrice: null,
    currency: 'CLP',
    taxTreatment: treatments[config.kind],
    taxVerified: config.kind !== 'asmodee' && Boolean(config.taxVerifiedAt),
    packQuantity: null,
    edition: null,
    language: null,
    expansion: null,
    collectedAt: new Date().toISOString()
  };
}

export function extractHtmlProducts(
  html: string,
  supplierId: string,
  session: SupplierSession
) {
  const { config } = session;
  const $ = cheerio.load(html);
  if (!$(config.verification.accountSelector).length)
    throw new SupplierError('session_expired');
  const products: SupplierProduct[] = [];
  $(config.catalog.productSelector).each((_, node) => {
    const card = $(node);
    const link = card
      .find(
        'a.woocommerce-LoopProduct-link, a[href*="/products/"], a[href*="/producto/"]'
      )
      .first();
    const href = link.attr('href');
    if (!href) throw new SupplierError('product_url_missing');
    const product = baseProduct(supplierId, config);
    product.url = session.url(href).href;
    product.supplierProductId =
      card.attr('data-product-id') ||
      card.find('[data-product_id]').first().attr('data-product_id') ||
      '';
    product.name = card
      .find('.woocommerce-loop-product__title, .card__heading, h2, h3')
      .first()
      .text()
      .trim();
    product.sku =
      card.attr('data-product-sku') ||
      card.find('[data-product_sku]').first().attr('data-product_sku') ||
      card.find('.sku').first().text().trim() ||
      null;
    product.barcode = card.attr('data-barcode') || null;
    product.categories = card
      .find('.posted_in a, .product-category a')
      .map((_, category) => $(category).text().trim())
      .get();
    const price = card.find(config.catalog.priceSelector).first();
    product.purchasePrice = parseClp(price.attr('content') ?? price.text());
    const inStock =
      card.is(config.catalog.inStockSelector) ||
      card.find(config.catalog.inStockSelector).length > 0;
    const outOfStock =
      card.is(config.catalog.outOfStockSelector) ||
      card.find(config.catalog.outOfStockSelector).length > 0;
    product.availability =
      inStock === outOfStock
        ? 'unknown'
        : inStock
          ? 'in_stock'
          : 'out_of_stock';
    product.packQuantity = quantity(card.attr('data-pack-quantity'));
    product.edition = card.attr('data-edition') || null;
    product.language = card.attr('data-language') || null;
    const expansion = card.attr('data-expansion');
    product.expansion =
      expansion === 'true' ? true : expansion === 'false' ? false : null;
    products.push(product);
  });
  const next = $(config.catalog.nextSelector).first().attr('href');
  if (!next && !$(config.catalog.terminalSelector).length)
    throw new SupplierError('incomplete_catalog');
  return {
    products,
    next: next ? session.url(next).href : null,
    total: null as number | null
  };
}

export function extractStructuredProducts(
  payload: unknown,
  supplierId: string,
  session: SupplierSession
) {
  const shape = session.config.catalog.structured;
  if (!shape)
    throw new SupplierError('authenticated_catalog_request_not_configured');
  const items = field(payload, shape.itemsPath);
  const next = field(payload, shape.nextPath);
  const total = field(payload, shape.totalPath);
  if (
    !Array.isArray(items) ||
    (next !== null && next !== false && typeof next !== 'string')
  ) {
    throw new SupplierError('catalog_response_changed');
  }
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 1)
    throw new SupplierError('catalog_total_missing');
  const products = items.map((item): SupplierProduct => {
    const product = baseProduct(supplierId, session.config);
    product.supplierProductId = text(field(item, shape.id)) ?? '';
    product.name = text(field(item, shape.name)) ?? '';
    product.sku = text(field(item, shape.sku));
    product.barcode = text(field(item, shape.barcode));
    const url = text(field(item, shape.url));
    if (!url) throw new SupplierError('product_url_missing');
    product.url = session.url(url).href;
    const categories = field(item, shape.categories);
    product.categories = Array.isArray(categories)
      ? categories.filter(
          (category): category is string => typeof category === 'string'
        )
      : [];
    const stock = field(item, shape.availability);
    product.availability =
      stock === shape.inStockValue
        ? 'in_stock'
        : stock === shape.outOfStockValue
          ? 'out_of_stock'
          : 'unknown';
    const price = field(item, shape.purchasePrice);
    product.purchasePrice = parseClp(
      typeof price === 'string' || typeof price === 'number' ? price : null
    );
    product.packQuantity = quantity(field(item, shape.packQuantity));
    product.edition = text(field(item, shape.edition));
    product.language = text(field(item, shape.language));
    const expansion = field(item, shape.expansion);
    product.expansion = typeof expansion === 'boolean' ? expansion : null;
    return product;
  });
  return {
    products,
    next: next ? session.url(next as string).href : null,
    total
  };
}

export async function collectSupplierCatalog(
  supplierId: string,
  session: SupplierSession
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await session.authenticate();
      if (
        session.config.kind === 'asmodee' &&
        !session.config.catalog.structured
      ) {
        throw new SupplierError('authenticated_catalog_request_not_configured');
      }
      const products = new Map<string, SupplierProduct>();
      const visited = new Set<string>();
      let pages = 0;
      for (const path of session.config.catalog.paths) {
        let next: string | null = session.url(path).href;
        const chain = new Set<string>();
        const pathProducts = new Set<string>();
        let expectedTotal: number | null = null;
        while (next) {
          if (chain.has(next)) throw new SupplierError('pagination_cycle');
          chain.add(next);
          if (visited.has(next)) break;
          visited.add(next);
          if (++pages > session.config.catalog.maxPages)
            throw new SupplierError('pagination_limit_reached');
          const response = await session.request(next);
          let page;
          if (session.config.catalog.structured) {
            page = extractStructuredProducts(
              await response.json(),
              supplierId,
              session
            );
          } else {
            let html = await response.text();
            if (
              session.config.kind === 'lanae' &&
              session.config.browserRendering &&
              !cheerio
                .load(html)(session.config.catalog.priceSelector)
                .text()
                .match(/\d/)
            ) {
              html = await session.render(
                next,
                session.config.catalog.priceSelector
              );
            }
            page = extractHtmlProducts(html, supplierId, session);
          }
          if (page.total !== null) {
            if (expectedTotal !== null && expectedTotal !== page.total)
              throw new SupplierError('catalog_total_changed');
            expectedTotal = page.total;
          }
          if (!page.products.length)
            throw new SupplierError('empty_catalog_page');
          for (const product of page.products) {
            pathProducts.add(product.supplierProductId);
            const previous = products.get(product.supplierProductId);
            if (
              previous &&
              (previous.purchasePrice !== product.purchasePrice ||
                previous.availability !== product.availability ||
                supplierProductIdentity(previous) !==
                  supplierProductIdentity(product))
            ) {
              throw new SupplierError('conflicting_duplicate_product');
            }
            if (previous)
              product.categories = Array.from(
                new Set([...previous.categories, ...product.categories])
              );
            products.set(product.supplierProductId, product);
          }
          next = page.next;
        }
        if (expectedTotal !== null && expectedTotal !== pathProducts.size)
          throw new SupplierError('incomplete_catalog');
      }
      await session.verify();
      const result = Array.from(products.values());
      if (result.length < session.config.catalog.expectedMinimum)
        throw new SupplierError('catalog_below_expected_minimum');
      if (!result.some((product) => product.purchasePrice !== null)) {
        throw new SupplierError(
          session.config.kind === 'lanae'
            ? 'authenticated_pricing_or_browser_rendering_required'
            : 'account_prices_not_verified'
        );
      }
      const validation = validateSupplierRun({
        authenticated: true,
        complete: true,
        products: result
      });
      if (!validation.accepted) throw new SupplierError(validation.errors[0]);
      return result;
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof SupplierError &&
        ['session_expired', 'account_prices_not_verified'].includes(error.code)
      )
        continue;
      if (error instanceof SupplierError) throw error;
      throw new SupplierError('catalog_response_invalid');
    }
  }
  throw new SupplierError('session_expired');
}
