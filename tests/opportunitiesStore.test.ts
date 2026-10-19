import { beforeEach, expect, test, vi } from 'vitest';
import type { SupplierIntegration } from '@prisma/client';
import {
  integrationSchema,
  readIntegration
} from '../lib/scraping/supplier-session';

const db = vi.hoisted(() => {
  const delegate = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn()
  });
  return {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    supplierIntegration: delegate(),
    supplierCatalogRun: delegate(),
    supplierCatalogProduct: delegate(),
    supplierProductObservation: delegate(),
    externalStockObservation: delegate(),
    supplierProductMappingReview: delegate(),
    productVariant: delegate()
  };
});
vi.mock('server-only', () => ({}));
vi.mock('@jssprz/ludo2go-database', () => ({ prisma: db }));
import {
  finishSupplierRun,
  persistSupplierApproval,
  persistSupplierMapping,
  readSupplierStage,
  startSupplierRun,
  type OpportunityRun
} from '../lib/opportunities-store';
import {
  supplierProductIdentity,
  type SupplierProduct
} from '../lib/scraping/supplier-catalog';

const now = new Date();
const product: SupplierProduct = {
  supplierId: 'supplier',
  supplierProductId: 'remote',
  sku: 'SKU',
  barcode: null,
  name: 'Game',
  url: 'https://btb.devir.cl/game',
  categories: [],
  availability: 'in_stock',
  purchasePrice: 12990,
  currency: 'CLP',
  taxTreatment: 'unconfirmed',
  taxVerified: false,
  packQuantity: 1,
  edition: null,
  language: 'es',
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
const integration: SupplierIntegration = {
  id: 'integration',
  supplierId: 'supplier',
  adapterKey: 'devir',
  baseUrl: config.baseUrl,
  authMethod: 'form',
  usernameSecretRef: 'SUPPLIER_DEVIR_USERNAME',
  passwordSecretRef: 'SUPPLIER_DEVIR_PASSWORD',
  sessionSecretRef: null,
  browserSecretRef: null,
  browserRendering: false,
  config: { verification: config.verification, catalog: config.catalog },
  configVersion: 1,
  taxTreatment: 'unconfirmed',
  taxVerifiedAt: null,
  integrationVerifiedAt: null,
  isEnabled: true,
  createdAt: new Date(now.getTime() - 10000),
  updatedAt: new Date(now.getTime() - 10000)
};
const storedRun = {
  id: 'run',
  integrationId: 'integration',
  configVersion: 1,
  status: 'staged',
  startedAt: now,
  approvedAt: null,
  errors: [],
  flags: [],
  observations: [],
  externalStockObservations: []
};
const catalogProduct = {
  id: 'catalog-product',
  supplierProductId: 'remote',
  variantId: 'variant',
  mappingStatus: 'confirmed',
  reviewedIdentityFingerprint: supplierProductIdentity(product),
  reviewedAt: new Date(now.getTime() - 1000)
};
const observation = {
  ...product,
  id: 'observation',
  supplierCatalogProductId: catalogProduct.id,
  identityFingerprint: supplierProductIdentity(product),
  taxVerifiedAt: null,
  collectedAt: now,
  supplierCatalogProduct: catalogProduct
};
const run: OpportunityRun = {
  id: 'run',
  supplierId: 'supplier',
  supplierName: 'Supplier',
  collectedAt: now.toISOString(),
  status: 'staged',
  errors: [],
  flags: [],
  products: [
    {
      ...product,
      match: { variantId: 'variant', method: 'mapping', requiresReview: false },
      external: [],
      opportunity: false
    }
  ]
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (operation) => operation(db));
  db.supplierIntegration.findUnique.mockResolvedValue({
    ...integration,
    supplier: { name: 'Supplier', isActive: true },
    products: [catalogProduct]
  });
  db.supplierCatalogRun.findFirst.mockResolvedValue(storedRun);
  db.supplierCatalogRun.findUnique.mockResolvedValue({
    ...storedRun,
    status: 'running'
  });
  db.supplierCatalogProduct.findUnique.mockResolvedValue(catalogProduct);
  db.supplierCatalogProduct.upsert.mockResolvedValue(catalogProduct);
  db.supplierProductObservation.findUnique.mockResolvedValue(observation);
  db.supplierProductObservation.create.mockResolvedValue(observation);
  db.productVariant.findUnique.mockResolvedValue({ id: 'variant' });
});

test('maps actual integration columns and keeps secret references unresolved', () => {
  const parsed = readIntegration(integration)!;
  expect(parsed.kind).toBe('devir');
  expect(parsed.secrets.username).toBe('SUPPLIER_DEVIR_USERNAME');
  expect(parsed.taxVerifiedAt).toBeUndefined();
  expect(readIntegration(null)).toBeNull();
  expect(() =>
    readIntegration({ ...integration, adapterKey: 'unknown' })
  ).toThrow('unsupported_supplier_adapter');
  expect(() => readIntegration({ ...integration, isEnabled: false })).toThrow(
    'integration_disabled'
  );
  expect(() =>
    readIntegration({ ...integration, usernameSecretRef: 'raw-password' })
  ).toThrow('integration_config_invalid');
  expect(() =>
    readIntegration({
      ...integration,
      config: { ...(integration.config as object), password: 'not-accepted' }
    })
  ).toThrow('integration_config_invalid');
  expect(() =>
    readIntegration({ ...integration, baseUrl: 'https://other.example' })
  ).toThrow('integration_config_invalid');
});

test('active scans conflict under a transaction-scoped supplier lock', async () => {
  db.supplierCatalogRun.findFirst.mockResolvedValueOnce({
    ...storedRun,
    status: 'running'
  });
  await expect(
    startSupplierRun('supplier', 'integration', 1, 'admin')
  ).rejects.toThrow('scan_already_running');
  expect(db.$queryRaw).toHaveBeenCalledOnce();
  expect(db.supplierCatalogRun.create).not.toHaveBeenCalled();
});

test('expired attempts become failed history before a new audited run is reserved', async () => {
  db.supplierCatalogRun.findFirst.mockResolvedValueOnce({
    ...storedRun,
    startedAt: new Date(now.getTime() - 360000)
  });
  await startSupplierRun('supplier', 'integration', 1, 'admin');
  expect(db.supplierCatalogRun.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'failed',
        errors: ['scan_lease_expired']
      })
    })
  );
  expect(db.supplierCatalogRun.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      requestedByAdminUserId: 'admin',
      status: 'running',
      baselineRunId: 'run'
    })
  });
});

test('config races cannot reserve or finalize a scan', async () => {
  await expect(startSupplierRun('supplier', 'integration', 2)).rejects.toThrow(
    'integration_changed'
  );
  db.supplierIntegration.findUnique.mockResolvedValueOnce({
    ...integration,
    configVersion: 2
  });
  await finishSupplierRun(run, 'integration', 1);
  expect(db.supplierCatalogRun.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'failed',
        errors: ['integration_changed']
      })
    })
  );
  expect(db.supplierProductObservation.create).not.toHaveBeenCalled();
});

test('completion appends immutable observations and invalidation audit without editing history', async () => {
  db.supplierCatalogProduct.upsert.mockResolvedValueOnce({
    ...catalogProduct,
    reviewedIdentityFingerprint: 'old-identity'
  });
  await finishSupplierRun(run, 'integration', 1);
  expect(db.supplierProductObservation.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      runId: 'run',
      identityFingerprint: supplierProductIdentity(product),
      purchasePrice: 12990
    })
  });
  expect(db.supplierProductObservation.update).not.toHaveBeenCalled();
  expect(db.supplierProductMappingReview.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: 'invalidated',
      observationId: 'observation',
      previousVariantId: 'variant'
    })
  });
  expect(db.supplierCatalogProduct.update).toHaveBeenCalledWith({
    where: { id: catalogProduct.id },
    data: { mappingStatus: 'needs_review' }
  });
});

test('failed and rejected scans retain outcomes and cannot finalize twice', async () => {
  await finishSupplierRun(
    {
      ...run,
      status: 'failed',
      errors: ['authentication_failed'],
      products: []
    },
    'integration',
    1
  );
  expect(db.supplierCatalogRun.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: 'failed', authenticatedAt: null })
    })
  );
  expect(db.supplierProductObservation.create).not.toHaveBeenCalled();
  db.supplierCatalogRun.findUnique.mockResolvedValueOnce(storedRun);
  await expect(finishSupplierRun(run, 'integration', 1)).rejects.toThrow(
    'scan_superseded'
  );
});

test('mapping confirmation atomically records previous mapping, observation and admin', async () => {
  await persistSupplierMapping(
    {
      supplierId: 'supplier',
      supplierProductId: 'remote',
      variantId: 'variant'
    },
    'admin'
  );
  expect(db.$transaction).toHaveBeenCalledOnce();
  expect(db.$queryRaw).toHaveBeenCalledOnce();
  expect(db.supplierProductMappingReview.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: 'confirmed',
      observationId: 'observation',
      previousVariantId: 'variant',
      reviewedByAdminUserId: 'admin',
      identityFingerprint: observation.identityFingerprint
    })
  });
  expect(db.supplierCatalogProduct.update).toHaveBeenCalledWith({
    where: { id: catalogProduct.id },
    data: expect.objectContaining({
      mappingStatus: 'confirmed',
      reviewedByAdminUserId: 'admin'
    })
  });
  expect(db.externalStockObservation.update).not.toHaveBeenCalled();
});

test('audit failures abort mapping updates', async () => {
  db.supplierProductMappingReview.create.mockRejectedValueOnce(
    new Error('audit unavailable')
  );
  await expect(
    persistSupplierMapping(
      {
        supplierId: 'supplier',
        supplierProductId: 'remote',
        variantId: 'variant'
      },
      'admin'
    )
  ).rejects.toThrow('audit unavailable');
  expect(db.supplierCatalogProduct.update).not.toHaveBeenCalled();
});

test.each(['running', 'failed', 'rejected'])(
  'reviews cannot race a newer %s run',
  async (status) => {
    db.supplierCatalogRun.findFirst.mockResolvedValue({ ...storedRun, status });
    await expect(
      persistSupplierMapping(
        {
          supplierId: 'supplier',
          supplierProductId: 'remote',
          variantId: 'variant'
        },
        'admin'
      )
    ).rejects.toThrow('run_not_approvable');
    await expect(
      persistSupplierApproval('supplier', 'run', 'admin')
    ).rejects.toThrow('run_not_approvable');
    expect(db.supplierProductMappingReview.create).not.toHaveBeenCalled();
  }
);

test('approval is locked, latest-only, fresh and does not overwrite its original admin', async () => {
  await expect(
    persistSupplierApproval('supplier', 'older', 'admin')
  ).rejects.toThrow('run_not_approvable');
  await persistSupplierApproval('supplier', 'run', 'admin');
  expect(db.supplierCatalogRun.update).toHaveBeenCalledWith({
    where: { id: 'run' },
    data: expect.objectContaining({ approvedByAdminUserId: 'admin' })
  });
  db.supplierCatalogRun.update.mockClear();
  db.supplierCatalogRun.findFirst.mockResolvedValueOnce({
    ...storedRun,
    approvedAt: now,
    approvedByAdminUserId: 'original'
  });
  await persistSupplierApproval('supplier', 'run', 'another');
  expect(db.supplierCatalogRun.update).not.toHaveBeenCalled();
  db.supplierCatalogRun.findFirst.mockResolvedValueOnce({
    ...storedRun,
    startedAt: new Date(now.getTime() - 3600001)
  });
  await expect(
    persistSupplierApproval('supplier', 'run', 'admin')
  ).rejects.toThrow('run_not_approvable');
});

test('read path retains unknown external evidence and hides checks predating mapping review', async () => {
  const external = {
    storeId: 'store',
    variantId: 'variant',
    store: { name: 'Store' },
    requestedUrl: 'https://store.example/game',
    checkedAt: now,
    expiresAt: new Date(now.getTime() + 3600000),
    availability: 'out_of_stock',
    status: 'checked',
    identityVerified: true
  };
  db.supplierCatalogRun.findFirst.mockResolvedValue({
    ...storedRun,
    observations: [observation],
    externalStockObservations: [
      external,
      {
        ...external,
        storeId: 'unknown-store',
        status: 'failed',
        availability: 'unknown'
      }
    ]
  });
  const { stage } = await readSupplierStage('supplier');
  expect(
    stage.run?.products[0].external.map((item) => item.availability)
  ).toEqual(['out_of_stock', 'unknown']);
  db.supplierCatalogRun.findFirst.mockResolvedValue({
    ...storedRun,
    observations: [
      {
        ...observation,
        supplierCatalogProduct: {
          ...catalogProduct,
          reviewedAt: new Date(now.getTime() + 1000)
        }
      }
    ],
    externalStockObservations: [external]
  });
  expect(
    (await readSupplierStage('supplier')).stage.run?.products[0].external
  ).toEqual([]);
});

test('changed identity and config never reuse qualifying external evidence', async () => {
  db.supplierCatalogRun.findFirst.mockResolvedValue({
    ...storedRun,
    configVersion: 0,
    observations: [{ ...observation, identityFingerprint: 'changed' }],
    externalStockObservations: []
  });
  const { stage } = await readSupplierStage('supplier');
  expect(stage.run?.flags).toContain('integration_changed');
  expect(stage.run?.products[0].external).toEqual([]);
});

function serializeMockTransactions() {
  let pending: Promise<unknown> = Promise.resolve();
  db.$transaction.mockImplementation((operation) => {
    const current = pending.then(() => operation(db));
    pending = current.catch(() => undefined);
    return current;
  });
}

test('competing scan reservations admit one worker under serialized lock admission', async () => {
  serializeMockTransactions();
  let active = false;
  db.supplierCatalogRun.findFirst.mockImplementation(async (query) =>
    query.where.status === 'running'
      ? active
        ? { ...storedRun, status: 'running' }
        : null
      : null
  );
  db.supplierCatalogRun.create.mockImplementation(async () => {
    active = true;
    return { ...storedRun, status: 'running' };
  });
  const outcomes = await Promise.allSettled([
    startSupplierRun('supplier', 'integration', 1, 'first-admin'),
    startSupplierRun('supplier', 'integration', 1, 'second-admin')
  ]);
  expect(outcomes.map((outcome) => outcome.status)).toEqual([
    'fulfilled',
    'rejected'
  ]);
  expect(db.supplierCatalogRun.create).toHaveBeenCalledOnce();
  expect(db.$queryRaw).toHaveBeenCalledTimes(2);
  expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
    db.supplierCatalogRun.findFirst.mock.invocationCallOrder[0]
  );
});

test('concurrent mapping confirmations audit the actual preceding mapping', async () => {
  serializeMockTransactions();
  let variantId = 'original';
  db.supplierCatalogProduct.findUnique.mockImplementation(async () => ({
    ...catalogProduct,
    variantId
  }));
  db.productVariant.findUnique.mockImplementation(async (query) => ({
    id: query.where.id
  }));
  db.supplierCatalogProduct.update.mockImplementation(async (query) => {
    variantId = query.data.variantId;
  });
  await Promise.all([
    persistSupplierMapping(
      {
        supplierId: 'supplier',
        supplierProductId: 'remote',
        variantId: 'first'
      },
      'first-admin'
    ),
    persistSupplierMapping(
      {
        supplierId: 'supplier',
        supplierProductId: 'remote',
        variantId: 'second'
      },
      'second-admin'
    )
  ]);
  expect(
    db.supplierProductMappingReview.create.mock.calls.map(([query]) => [
      query.data.previousVariantId,
      query.data.variantId,
      query.data.reviewedByAdminUserId
    ])
  ).toEqual([
    ['original', 'first', 'first-admin'],
    ['first', 'second', 'second-admin']
  ]);
  expect(db.$queryRaw).toHaveBeenCalledTimes(2);
});

test('concurrent approvals preserve the first committed approver', async () => {
  serializeMockTransactions();
  let approved = false;
  db.supplierCatalogRun.findFirst.mockImplementation(async () => ({
    ...storedRun,
    approvedAt: approved ? now : null
  }));
  db.supplierCatalogRun.update.mockImplementation(async () => {
    approved = true;
  });
  await Promise.all([
    persistSupplierApproval('supplier', 'run', 'first-admin'),
    persistSupplierApproval('supplier', 'run', 'second-admin')
  ]);
  expect(db.supplierCatalogRun.update).toHaveBeenCalledOnce();
  expect(db.supplierCatalogRun.update).toHaveBeenCalledWith({
    where: { id: 'run' },
    data: expect.objectContaining({ approvedByAdminUserId: 'first-admin' })
  });
});
