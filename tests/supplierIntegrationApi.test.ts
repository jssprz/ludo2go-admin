import { beforeEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/supplier-integration-store', async () => {
  const actual = await vi.importActual<typeof import('../lib/supplier-integration-store')>('../lib/supplier-integration-store');
  return { ...actual, getSupplierIntegration: mocks.get, saveSupplierIntegration: mocks.save };
});
vi.mock('server-only', () => ({}));
vi.mock('@jssprz/ludo2go-database', () => ({ prisma: {} }));
import { GET, PUT } from '../app/api/suppliers/[id]/integration/route';
import { IntegrationEditorError } from '../lib/supplier-integration-store';
import { supplierIntegrationInput } from '../lib/supplier-integration-schema';
const context = { params: Promise.resolve({ id: 'supplier' }) };
const request = (body: unknown = {}, origin = 'https://admin.example') => new Request('https://admin.example/api/suppliers/supplier/integration', {
  method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body)
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'admin' } });
  mocks.get.mockResolvedValue({ integration: null, configVersion: null });
  mocks.save.mockResolvedValue({ integration: null, configVersion: null });
});
test('GET and PUT require authentication; cross-origin saves never reach storage', async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await GET(request(), context)).status).toBe(401);
  expect((await PUT(request(), context)).status).toBe(401);
  mocks.auth.mockResolvedValue({ user: { id: 'admin' } });
  expect((await PUT(request({}, 'https://evil.example'), context)).status).toBe(403);
  expect(mocks.save).not.toHaveBeenCalled();
});
test('GET is private/no-store and returns the explicit editor projection only', async () => {
  const integration = { usernameSecretRef: 'SUPPLIER_DEVIR_USERNAME', config: {} };
  mocks.get.mockResolvedValue({ integration, configVersion: 1 });
  const response = await GET(request(), context);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ integration, configVersion: 1 });
});
test('not found, stale revisions, running scans and missing schema have precise statuses', async () => {
  for (const [code, status] of [['supplier_not_found', 404], ['integration_conflict', 409], ['scan_already_running', 409]] as const) {
    mocks.save.mockRejectedValueOnce(new IntegrationEditorError(code));
    const response = await PUT(request(), context);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  }
  for (const code of ['P2021', 'P2022']) {
    mocks.get.mockRejectedValueOnce({ code, message: 'private details' });
    const response = await GET(request(), context);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'database_migration_required' });
  }
});
test('malformed JSON and schema errors return safe fields, never raw input or exceptions', async () => {
  const malformed = new Request('https://admin.example', { method: 'PUT', body: '{' });
  expect((await PUT(malformed, context)).status).toBe(400);
  const parsed = supplierIntegrationInput.safeParse({ passwordSecretRef: 'private-password' });
  if (!parsed.success) mocks.save.mockRejectedValueOnce(parsed.error);
  const response = await PUT(request(), context);
  expect(response.status).toBe(400);
  expect(JSON.stringify(await response.json())).not.toContain('private-password');
  mocks.save.mockRejectedValueOnce(new Error('private upstream details'));
  expect(await (await PUT(request(), context)).json()).toEqual({ error: 'integration_request_failed' });
});