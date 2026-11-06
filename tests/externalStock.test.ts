import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkExternalStock,
  extractExternalAvailability,
  inspectExternalPage
} from '../lib/scraping/external-stock';

test('only explicit stock evidence counts; absent price and login failures are unknown', () => {
  assert.equal(extractExternalAvailability('<p>Login required</p>'), 'unknown');
  assert.equal(
    extractExternalAvailability('<span class="price">$12.990</span>'),
    'unknown'
  );
  assert.equal(
    extractExternalAvailability(
      '<div class="summary"><p class="stock out-of-stock">Agotado</p></div>'
    ),
    'out_of_stock'
  );
  assert.equal(
    extractExternalAvailability(
      '<div class="related"><p class="stock out-of-stock">Agotado</p></div>'
    ),
    'unknown'
  );
});
test('schema product offers support in stock and out of stock; contradictory variants remain unknown', () => {
  const html = (offers: unknown) =>
    `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', offers })}</script>`;
  assert.equal(
    extractExternalAvailability(
      html({ availability: 'https://schema.org/OutOfStock' })
    ),
    'out_of_stock'
  );
  assert.equal(
    extractExternalAvailability(
      html({ availability: 'https://schema.org/InStock' })
    ),
    'in_stock'
  );
  assert.equal(
    extractExternalAvailability(
      html([{ availability: 'InStock' }, { availability: 'OutOfStock' }])
    ),
    'unknown'
  );
  assert.equal(
    extractExternalAvailability(html({ availability: 'PreOrder' })),
    'unknown'
  );
});
test('competitor checks use the matched product offer and WooCommerce product state', () => {
  const product = (name: string, availability: string) =>
    `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Product',
      name,
      offers: { availability }
    })}</script>`;
  const relatedProducts = `${product('Related game', 'InStock')}${product(
    'Donde las Papas Queman',
    'OutOfStock'
  )}`;
  assert.equal(
    inspectExternalPage(
      relatedProducts,
      undefined,
      'Devir Donde las Papas Queman (Español)'
    ).availability,
    'out_of_stock'
  );
  assert.equal(
    inspectExternalPage(
      '<body class="single-product"><main><div class="elementor-location-single product instock"></div></main></body>',
      undefined,
      'Donde las Papas Queman'
    ).availability,
    'in_stock'
  );
  assert.equal(
    inspectExternalPage(
      '<body class="single-product"><main><div class="elementor-location-single product outofstock"></div></main></body>',
      undefined,
      'Donde las Papas Queman'
    ).availability,
    'out_of_stock'
  );
  assert.equal(
    inspectExternalPage(
      '<body class="single-product"><main><div class="product instock"></div><section class="related"><div class="product outofstock"></div></section></main></body>',
      undefined,
      'Donde las Papas Queman'
    ).availability,
    'in_stock'
  );
});
test('private addresses and unsupported URLs never produce stock observations', async () => {
  assert.equal(await checkExternalStock('http://127.0.0.1/private'), 'unknown');
  assert.equal(await checkExternalStock('http://[::1]/private'), 'unknown');
  assert.equal(await checkExternalStock('file:///etc/passwd'), 'unknown');
});

test('mismatching or absent retailer identifiers cannot prove ERP variant stock', () => {
  const product = (sku: string) =>
    `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', sku, offers: { availability: 'OutOfStock' } })}</script>`;
  assert.equal(
    extractExternalAvailability(product('OTHER'), {
      sku: 'EXPECTED',
      barcode: null
    }),
    'unknown'
  );
  assert.equal(
    extractExternalAvailability(product('EXPECTED'), {
      sku: 'EXPECTED',
      barcode: null
    }),
    'out_of_stock'
  );
  assert.equal(
    extractExternalAvailability(
      '<div class="summary"><p class="stock out-of-stock">Agotado</p></div>',
      { sku: 'EXPECTED', barcode: null }
    ),
    'unknown'
  );
});
