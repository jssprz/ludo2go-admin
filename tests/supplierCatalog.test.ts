import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOpportunity,
  matchSupplierProduct,
  parseClp,
  supplierProductIdentity,
  validateSupplierRun,
  type SupplierProduct
} from '../lib/scraping/supplier-catalog';

const product: SupplierProduct = {
  supplierId: 'supplier',
  supplierProductId: '123',
  sku: 'SKU',
  barcode: '780123',
  name: 'Game',
  url: 'https://lanae.cl/products/game',
  categories: [],
  availability: 'in_stock',
  purchasePrice: 10000,
  currency: 'CLP',
  taxTreatment: 'excluding_vat',
  taxVerified: false,
  packQuantity: null,
  edition: null,
  language: null,
  expansion: null,
  collectedAt: '2026-10-18T00:00:00Z'
};
const variants = [
  { id: 'variant', sku: 'SKU', barcode: '780123', name: 'Game' }
];

test('CLP prices preserve missing values instead of inventing zero prices', () => {
  assert.equal(parseClp('$ 12.990'), 12990);
  assert.equal(parseClp('12.990,50'), 12990.5);
  assert.equal(parseClp('12990.50'), 12990.5);
  assert.equal(parseClp(null), null);
  assert.equal(parseClp('Inicia sesion'), null);
  assert.equal(parseClp(''), null);
});

test('reviewed supplier mappings take priority; identifier and name matches need review', () => {
  assert.deepEqual(
    matchSupplierProduct(product, variants, [
      {
        supplierProductId: '123',
        variantId: 'variant',
        reviewed: true,
        identityFingerprint: supplierProductIdentity(product)
      }
    ]),
    { variantId: 'variant', method: 'mapping', requiresReview: false }
  );
  assert.equal(matchSupplierProduct(product, variants, []).method, 'barcode');
  assert.equal(
    matchSupplierProduct(product, variants, []).requiresReview,
    true
  );
  assert.equal(
    matchSupplierProduct({ ...product, barcode: null, sku: null }, variants, [])
      .method,
    'name_proposal'
  );
});

test('changed product identity invalidates reviewed supplier mappings', () => {
  const mapping = {
    supplierProductId: '123',
    variantId: 'variant',
    reviewed: true,
    identityFingerprint: supplierProductIdentity(product)
  };
  assert.equal(
    matchSupplierProduct({ ...product, packQuantity: 6 }, variants, [mapping])
      .requiresReview,
    true
  );
  assert.equal(
    matchSupplierProduct({ ...product, language: 'en' }, variants, [mapping])
      .requiresReview,
    true
  );
});

test('unknown stock, missing links and unreviewed matches never become opportunities', () => {
  const match = {
    variantId: 'variant',
    method: 'mapping' as const,
    requiresReview: false
  };
  assert.equal(isOpportunity(product, match, ['out_of_stock']), true);
  assert.equal(
    isOpportunity(product, match, ['out_of_stock', 'unknown']),
    false
  );
  assert.equal(isOpportunity(product, match, []), false);
  assert.equal(
    isOpportunity(product, { ...match, requiresReview: true }, [
      'out_of_stock'
    ]),
    false
  );
});

test('rejects incomplete and unauthenticated runs; flags count and price changes', () => {
  assert.equal(
    validateSupplierRun({
      authenticated: false,
      complete: true,
      products: [product]
    }).accepted,
    false
  );
  assert.equal(
    validateSupplierRun({
      authenticated: true,
      complete: false,
      products: [product]
    }).accepted,
    false
  );
  assert.equal(
    validateSupplierRun({ authenticated: true, complete: true, products: [] })
      .accepted,
    false
  );
  const result = validateSupplierRun({
    authenticated: true,
    complete: true,
    products: [{ ...product, purchasePrice: 20000 }],
    previous: [product, { ...product, supplierProductId: '456' }]
  });
  assert.equal(result.accepted, true);
  assert.ok(result.flags.includes('price_changed'));
  assert.ok(result.flags.includes('product_count_changed'));
});
