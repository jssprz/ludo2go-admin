import { beforeEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  supplier: vi.fn(),
  variants: vi.fn(),
  integration: vi.fn(),
  links: vi.fn(),
  read: vi.fn(),
  start: vi.fn(),
  finish: vi.fn(),
  collect: vi.fn(),
  check: vi.fn()
}));
vi.mock('server-only', () => ({}));
vi.mock('@jssprz/ludo2go-database', () => ({
  prisma: {
    supplier: { findUnique: mocks.supplier, findMany: vi.fn() },
    supplierIntegration: { findUnique: mocks.integration },
    productVariant: { findMany: mocks.variants },
    itemPriceInStore: { findMany: mocks.links }
  }
}));
vi.mock('../lib/opportunities-store', () => ({
  readSupplierStage: mocks.read,
  startSupplierRun: mocks.start,
  finishSupplierRun: mocks.finish,
  persistSupplierMapping: vi.fn(),
  persistSupplierApproval: vi.fn()
}));
vi.mock('../lib/scraping/supplier-adapters', () => ({
  collectSupplierCatalog: mocks.collect
}));
vi.mock('../lib/scraping/external-stock', () => ({
  checkExternalStock: mocks.check
}));
import { scanOpportunities } from '../lib/opportunities';
import {
  integrationSchema,
  SupplierError
} from '../lib/scraping/supplier-session';
import { supplierProductIdentity } from '../lib/scraping/supplier-catalog';

const now = new Date();
const product = {
  supplierId: 'supplier',
  supplierProductId: 'remote',
  sku: 'SKU',
  barcode: null,
  name: 'Game',
  url: 'https://btb.devir.cl/game',
  categories: [],
  availability: 'in_stock' as const,
  purchasePrice: 10000,
  currency: 'CLP' as const,
  taxTreatment: 'vat_included' as const,
  taxVerified: false,
  packQuantity: 1,
  edition: null,
  language: null,
  expansion: false,
  collectedAt: now.toISOString()
};
const config = integrationSchema.parse({
  kind: 'devir',
  baseUrl: 'https://btb.devir.cl',
  auth: 'form',
  secrets: {},
  verification: {
    path: '/catalog',
    accountSelector: '.account',
    account: {
      path: '/account',
      expectedIdentity: 'fixture',
      identitySelector: '.account'
    },
    priceSelector: '.price',
    priceEvidence: 'account_purchase_price',
    verifiedAt: now.toISOString()
  },
  catalog: {
    paths: ['/catalog'],
    terminalSelector: '.last',
    priceSelector: '.price',
    inStockSelector: '.stock',
    outOfStockSelector: '.out',
    expectedMinimum: 1
  }
});
const integration = {
  id: 'integration',
  adapterKey: 'devir',
  isEnabled: true,
  configVersion: 1,
  updatedAt: now,
  baseUrl: config.baseUrl,
  authMethod: 'form',
  usernameSecretRef: 'SUPPLIER_DEVIR_USERNAME',
  passwordSecretRef: 'SUPPLIER_DEVIR_PASSWORD',
  config: { catalog: config.catalog, verification: config.verification },
  taxTreatment: 'unconfirmed',
  taxVerifiedAt: null
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.supplier.mockResolvedValue({
    id: 'supplier',
    name: 'Supplier',
    isActive: true,
    notes: 'legacy notes ignored',
    integration
  });
  mocks.variants.mockResolvedValue([
    { id: 'variant', sku: 'SKU', eanUpc: null, product: { name: 'Game' } }
  ]);
  mocks.start.mockResolvedValue({ id: 'run', startedAt: now });
  mocks.read.mockResolvedValue({
    stage: {
      supplierId: 'supplier',
      mappings: [],
      baseline: [],
      run: { id: 'run', status: 'failed', flags: [], errors: [], products: [] }
    }
  });
  mocks.collect.mockResolvedValue([{ ...product }]);
  mocks.links.mockResolvedValue([]);
});

test('first complete catalog is staged with an explicit baseline review flag and DB tax policy', async () => {
  await scanOpportunities('supplier', 'admin');
  expect(mocks.start).toHaveBeenCalledWith(
    'supplier',
    'integration',
    1,
    'admin',
    now
  );
  expect(mocks.finish).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'staged',
      flags: ['tax_unverified', 'baseline_review_required'],
      products: [
        expect.objectContaining({
          taxTreatment: 'unconfirmed',
          taxVerified: false
        })
      ]
    }),
    'integration',
    1
  );
});

test('duplicate products reject the run instead of becoming a baseline', async () => {
  mocks.collect.mockResolvedValue([{ ...product }, { ...product }]);
  await scanOpportunities('supplier', 'admin');
  expect(mocks.finish).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'rejected',
      errors: ['duplicate_product']
    }),
    'integration',
    1
  );
});

test('supplier authentication failures persist a sanitized failed attempt', async () => {
  mocks.collect.mockRejectedValue(new SupplierError('authentication_failed'));
  await scanOpportunities('supplier', 'admin');
  expect(mocks.finish).toHaveBeenCalledWith(
    expect.objectContaining({
      status: 'failed',
      errors: ['authentication_failed'],
      products: []
    }),
    'integration',
    1
  );
});

test('missing DB config never falls back to legacy Notes', async () => {
  mocks.supplier.mockResolvedValue({
    isActive: true,
    integration: null,
    notes: 'legacy configured notes'
  });
  await expect(scanOpportunities('supplier', 'admin')).rejects.toThrow(
    'integration_not_configured'
  );
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.collect).not.toHaveBeenCalled();
});

test('identity changes prevent external checks even when an old mapping is confirmed', async () => {
  mocks.read.mockResolvedValue({
    stage: {
      supplierId: 'supplier',
      baseline: [product],
      mappings: [
        {
          supplierProductId: 'remote',
          variantId: 'variant',
          reviewed: true,
          identityFingerprint: supplierProductIdentity({
            ...product,
            name: 'Older edition'
          })
        }
      ],
      run: { status: 'failed', flags: [], products: [] }
    }
  });
  await scanOpportunities('supplier', 'admin');
  expect(mocks.links).not.toHaveBeenCalled();
  expect(mocks.finish).toHaveBeenCalledWith(
    expect.objectContaining({
      products: [
        expect.objectContaining({
          match: expect.objectContaining({ requiresReview: true }),
          external: [],
          opportunity: false
        })
      ]
    }),
    'integration',
    1
  );
});

test('all linked stores persist, including failed checks that block qualification', async () => {
  mocks.read.mockResolvedValue({
    stage: {
      supplierId: 'supplier',
      baseline: [product],
      mappings: [
        {
          supplierProductId: 'remote',
          variantId: 'variant',
          reviewed: true,
          identityFingerprint: supplierProductIdentity(product)
        }
      ],
      run: { status: 'failed', flags: [], products: [] }
    }
  });
  mocks.links.mockResolvedValue(
    ['a', 'b'].map((storeId) => ({
      variantId: 'variant',
      storeId,
      urlPathInStore: '/game',
      store: { name: storeId, url: `https://${storeId}.example` }
    }))
  );
  mocks.check
    .mockResolvedValueOnce('out_of_stock')
    .mockResolvedValueOnce('unknown');
  await scanOpportunities('supplier', 'admin');
  const saved = mocks.finish.mock.calls[0][0];
  expect(
    saved.products[0].external.map(
      (item: { availability: string }) => item.availability
    )
  ).toEqual(['out_of_stock', 'unknown']);
});
