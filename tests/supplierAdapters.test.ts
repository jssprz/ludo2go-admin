import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectSupplierCatalog,
  extractHtmlProducts,
  extractStructuredProducts
} from '../lib/scraping/supplier-adapters';
import {
  integrationSchema,
  SupplierSession,
  type SupplierIntegration
} from '../lib/scraping/supplier-session';

const config: SupplierIntegration = integrationSchema.parse({
  kind: 'devir',
  baseUrl: 'https://btb.devir.cl',
  auth: 'form',
  secrets: {
    username: 'SUPPLIER_DEVIR_USERNAME',
    password: 'SUPPLIER_DEVIR_PASSWORD'
  },
  verification: {
    path: '/catalog',
    accountSelector: '.account',
    account: {
      path: '/catalog',
      expectedIdentity: 'fixture-account',
      identitySelector: '.account'
    },
    priceSelector: '.wholesale',
    priceEvidence: 'account_purchase_price',
    verifiedAt: '2026-10-18T00:00:00Z'
  },
  catalog: {
    paths: ['/catalog'],
    terminalSelector: '.last-page',
    priceSelector: '.wholesale',
    inStockSelector: '.instock',
    outOfStockSelector: '.outofstock',
    expectedMinimum: 1
  }
});
const html =
  '<div class="account">fixture-account</div><li class="product instock" data-product-id="123"><a href="/producto/game" class="woocommerce-LoopProduct-link"><h2>Game</h2></a><span class="wholesale">$12.990</span></li><span class="last-page"></span>';

test('HTML extraction preserves missing prices, unknown stock, and tax verification state', () => {
  const result = extractHtmlProducts(
    html,
    'supplier',
    new SupplierSession(config)
  );
  assert.equal(result.products[0].purchasePrice, 12990);
  assert.equal(result.products[0].availability, 'in_stock');
  assert.equal(result.products[0].taxTreatment, 'vat_included');
  assert.equal(result.products[0].taxVerified, false);
  const missing = extractHtmlProducts(
    html.replace(' instock', '').replace('$12.990', ''),
    'supplier',
    new SupplierSession(config)
  );
  assert.equal(missing.products[0].purchasePrice, null);
  assert.equal(missing.products[0].availability, 'unknown');
});

test('sessions do not share cookies or forward them to another origin', async () => {
  const cookies: string[] = [];
  const transport: typeof fetch = async (_url, init) => {
    cookies.push(new Headers(init?.headers).get('cookie') ?? '');
    return new Response('ok', {
      headers: { 'set-cookie': 'session=isolated; Path=/; Secure' }
    });
  };
  const first = new SupplierSession(config, undefined, transport);
  const second = new SupplierSession(config, undefined, transport);
  await first.request('/');
  await first.request('/');
  await second.request('/');
  assert.deepEqual(cookies, ['', 'session=isolated', '']);
  await assert.rejects(
    first.request('https://example.com'),
    /supplier_origin_rejected/
  );
});

test('login fetches hidden tokens and resolves credentials only at authentication time', async () => {
  const reads: string[] = [];
  let submitted = '';
  const transport: typeof fetch = async (url, init) => {
    if (init?.method === 'POST') {
      submitted = String(init.body);
      return new Response('ok');
    }
    if (String(url).endsWith('/wp-login.php'))
      return new Response(
        '<form action="/wp-login.php"><input name="log"><input name="pwd"><input type="hidden" name="csrf" value="fixture"></form>'
      );
    return new Response(html);
  };
  const session = new SupplierSession(
    config,
    {
      async read(reference) {
        reads.push(reference);
        return 'fixture';
      }
    },
    transport
  );
  assert.equal(reads.length, 0);
  await session.authenticate();
  assert.equal(reads.length, 2);
  assert.equal(new URLSearchParams(submitted).get('csrf'), 'fixture');
});

test('expired session retries once and repeated authentication failure is rejected', async () => {
  let attempts = 0;
  const session = new SupplierSession(
    config,
    {
      async read() {
        return 'fixture';
      }
    },
    async () => {
      attempts++;
      return new Response('', { status: 401 });
    }
  );
  await assert.rejects(
    collectSupplierCatalog('supplier', session),
    /session_expired/
  );
  assert.equal(attempts, 2);
});

test('pagination cycles reject the whole catalog rather than accepting a partial run', async () => {
  const session = new SupplierSession(
    config,
    {
      async read() {
        return 'fixture';
      }
    },
    async (_url, init) => {
      if (init?.method === 'POST') return new Response('ok');
      if (String(_url).endsWith('/wp-login.php'))
        return new Response(
          '<form><input name="log"><input name="pwd"></form>'
        );
      return new Response(`${html}<a rel="next" href="/catalog">Next</a>`);
    }
  );
  await assert.rejects(
    collectSupplierCatalog('supplier', session),
    /pagination_cycle/
  );
});

test('missing next link without terminal-page evidence rejects the page', () => {
  assert.throws(
    () =>
      extractHtmlProducts(
        html.replace('class="last-page"', 'class="missing"'),
        'supplier',
        new SupplierSession(config)
      ),
    /incomplete_catalog/
  );
});

test('public prices with wrong account identity never verify authentication', async () => {
  const session = new SupplierSession(
    config,
    undefined,
    async () => new Response(html.replace('fixture-account', 'public'))
  );
  await assert.rejects(session.verify(), /session_expired/);
});

const asmodeeConfig = integrationSchema.parse({
  ...config,
  kind: 'asmodee',
  baseUrl: 'https://b2b.asmodee.cl',
  auth: 'asmodee_api',
  secrets: {
    username: 'SUPPLIER_ASMODEE_USERNAME',
    password: 'SUPPLIER_ASMODEE_PASSWORD'
  },
  verification: {
    ...config.verification,
    path: 'https://b2b-back.asmodee.cl/api/fixture-price',
    account: {
      path: 'https://b2b-back.asmodee.cl/api/auth',
      identityPath: 'id',
      expectedIdentity: 'account-123'
    },
    structuredPricePath: 'purchasePrice'
  },
  catalog: {
    ...config.catalog,
    paths: ['https://b2b-back.asmodee.cl/api/fixture-catalog'],
    structured: {
      itemsPath: 'items',
      nextPath: 'next',
      totalPath: 'total',
      id: 'id',
      name: 'name',
      sku: 'sku',
      barcode: 'barcode',
      url: 'url',
      categories: 'categories',
      availability: 'stock',
      inStockValue: true,
      outOfStockValue: false,
      purchasePrice: 'purchasePrice',
      packQuantity: 'pack',
      edition: 'edition',
      language: 'language',
      expansion: 'expansion',
      paginationVerifiedAt: '2026-10-18T00:00:00Z'
    }
  }
});
const structuredProduct = {
  id: '123',
  name: 'Game',
  sku: 'SKU',
  url: 'https://b2b.asmodee.cl/catalog/123',
  stock: true,
  purchasePrice: 12000
};

test('Asmodee logs into the observed endpoint and sends bearer credentials only to its backend', async () => {
  const requests: { url: string; bearer: string | null }[] = [];
  const session = new SupplierSession(
    asmodeeConfig,
    {
      async read() {
        return 'fixture';
      }
    },
    async (url, init) => {
      requests.push({
        url: String(url),
        bearer: new Headers(init?.headers).get('authorization')
      });
      if (String(url).endsWith('/api/login')) {
        assert.deepEqual(JSON.parse(String(init?.body)), {
          email: 'fixture',
          password: 'fixture',
          is_employee: 0
        });
        return Response.json({ plain_text_token: 'fixture-token' });
      }
      if (String(url).endsWith('/api/auth'))
        return Response.json({ id: 'account-123' });
      return Response.json({ purchasePrice: 12000 });
    }
  );
  await session.authenticate();
  await session.request('/catalog');
  assert.equal(requests[0].bearer, null);
  assert.equal(requests[1].bearer, 'Bearer fixture-token');
  assert.equal(requests.at(-1)?.bearer, null);
});

test('structured public pricing cannot verify a different account', async () => {
  const session = new SupplierSession(asmodeeConfig, undefined, async () =>
    Response.json({ id: 'wrong-account', purchasePrice: 12000 })
  );
  await assert.rejects(session.verify(), /session_expired/);
});

test('structured catalogs retain stable IDs and require explicit totals and next-page state', async () => {
  const session = new SupplierSession(asmodeeConfig);
  const result = extractStructuredProducts(
    { items: [structuredProduct], total: 1, next: null },
    'supplier',
    session
  );
  assert.equal(result.products[0].supplierProductId, '123');
  assert.equal(result.products[0].purchasePrice, 12000);
  assert.equal(result.products[0].taxTreatment, 'unconfirmed');
  assert.equal(result.products[0].packQuantity, null);
  assert.throws(
    () =>
      extractStructuredProducts(
        { items: [structuredProduct], next: null },
        'supplier',
        session
      ),
    /catalog_total_missing/
  );
  assert.throws(
    () =>
      extractStructuredProducts(
        { items: [structuredProduct], total: 1 },
        'supplier',
        session
      ),
    /catalog_response_changed/
  );
  const incomplete = new SupplierSession(
    asmodeeConfig,
    {
      async read() {
        return 'fixture';
      }
    },
    async (url) => {
      if (String(url).endsWith('/api/login'))
        return Response.json({ plain_text_token: 'fixture-token' });
      if (String(url).endsWith('/api/auth'))
        return Response.json({ id: 'account-123' });
      if (String(url).endsWith('/api/fixture-price'))
        return Response.json({ purchasePrice: 12000 });
      return Response.json({
        items: [structuredProduct],
        total: 2,
        next: null
      });
    }
  );
  await assert.rejects(
    collectSupplierCatalog('supplier', incomplete),
    /incomplete_catalog/
  );
});
