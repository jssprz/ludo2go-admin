import { beforeEach, expect, test, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $queryRaw: vi.fn(),
  supplier: { findUnique: vi.fn() },
  supplierIntegration: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  supplierCatalogRun: { findFirst: vi.fn() }
}));
vi.mock('server-only', () => ({}));
vi.mock('@jssprz/ludo2go-database', () => ({ prisma: db }));
import { getSupplierIntegration, saveSupplierIntegration } from '../lib/supplier-integration-store';
const draft = {
  updatedAt: null, adapterKey: 'devir', baseUrl: '', authMethod: 'form',
  usernameSecretRef: null, passwordSecretRef: null, sessionSecretRef: null,
  browserSecretRef: null, browserRendering: false, taxTreatment: 'unconfirmed',
  taxVerifiedAt: null, integrationVerifiedAt: null, isEnabled: false, config: {}
};
const row = { ...draft, id: 'integration', supplierId: 'supplier', configVersion: 1, createdAt: new Date(), updatedAt: new Date('2026-10-18T00:00:00Z') };
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async operation => operation(db));
  db.supplier.findUnique.mockResolvedValue({ id: 'supplier' });
  db.supplierIntegration.create.mockResolvedValue(row);
  db.supplierIntegration.update.mockImplementation(async ({ data }) => ({ ...row, ...data }));
});
test('creates and reloads a disabled incomplete draft under the supplier lock', async () => {
  await saveSupplierIntegration('supplier', draft);
  expect(db.$queryRaw).toHaveBeenCalled();
  expect(db.supplierIntegration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isEnabled: false, configVersion: 1, integrationVerifiedAt: null }) }));
  db.supplierIntegration.findUnique.mockResolvedValue(row);
  expect((await getSupplierIntegration('supplier')).integration?.config).toEqual({});
});
test('stale and concurrent-create saves are rejected without writes', async () => {
  db.supplierIntegration.findUnique.mockResolvedValue(row);
  await expect(saveSupplierIntegration('supplier', draft)).rejects.toMatchObject({ code: 'integration_conflict' });
  expect(db.supplierIntegration.update).not.toHaveBeenCalled();
});
test('live scans block saves, expired leases do not', async () => {
  db.supplierIntegration.findUnique.mockResolvedValue(row);
  db.supplierCatalogRun.findFirst.mockResolvedValue({ id: 'live' });
  await expect(saveSupplierIntegration('supplier', { ...draft, updatedAt: row.updatedAt.toISOString() })).rejects.toMatchObject({ code: 'scan_already_running' });
  expect(db.supplierCatalogRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ startedAt: { gt: expect.any(Date) } }) }));
  db.supplierCatalogRun.findFirst.mockResolvedValue(null);
  await expect(saveSupplierIntegration('supplier', { ...draft, updatedAt: row.updatedAt.toISOString(), baseUrl: 'https://btb.devir.cl' })).resolves.toMatchObject({ configVersion: 2 });
});
test('metadata does not bump configVersion; behavioral changes do', async () => {
  db.supplierIntegration.findUnique.mockResolvedValue(row);
  const current = { ...draft, updatedAt: row.updatedAt.toISOString() };
  expect((await saveSupplierIntegration('supplier', { ...current, integrationVerifiedAt: '2026-10-17T00:00:00Z' })).configVersion).toBe(1);
  expect((await saveSupplierIntegration('supplier', { ...current, usernameSecretRef: 'SUPPLIER_DEVIR_USERNAME' })).configVersion).toBe(2);
});
test('missing suppliers cannot create integrations', async () => {
  db.supplier.findUnique.mockResolvedValue(null);
  await expect(saveSupplierIntegration('missing', draft)).rejects.toMatchObject({ code: 'supplier_not_found' });
  await expect(getSupplierIntegration('missing')).rejects.toMatchObject({ code: 'supplier_not_found' });
});