import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  get: vi.fn(),
  scan: vi.fn(),
  map: vi.fn(),
  approve: vi.fn()
}));
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/opportunities', () => ({
  getOpportunities: mocks.get,
  scanOpportunities: mocks.scan,
  confirmSupplierMapping: mocks.map,
  approveSupplierRun: mocks.approve
}));
import { GET, POST, PATCH } from '../app/api/opportunities/route';

beforeEach(() => {
  mocks.auth.mockResolvedValue({ user: { id: 'admin' } });
  mocks.get.mockResolvedValue({ suppliers: [], variants: [], runs: [] });
  mocks.scan.mockResolvedValue({ id: 'run' });
});
function request(
  body: unknown,
  method = 'POST',
  origin = 'https://admin.example.com'
) {
  return new Request('https://admin.example.com/api/opportunities', {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body)
  });
}

test('all operations require an application session', async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect((await POST(request({ supplierId: 'supplier' }))).status).toBe(401);
  expect((await PATCH(request({}, 'PATCH'))).status).toBe(401);
  expect(mocks.scan).not.toHaveBeenCalled();
});
test('responses are private and never cache supplier prices', async () => {
  expect((await GET()).headers.get('Cache-Control')).toBe('private, no-store');
});
test('cross-origin mutations and unknown request fields are rejected', async () => {
  expect(
    (
      await POST(
        request({ supplierId: 'supplier' }, 'POST', 'https://other.example.com')
      )
    ).status
  ).toBe(403);
  expect(
    (
      await POST(
        request({ supplierId: 'supplier', credentials: 'not-accepted' })
      )
    ).status
  ).toBe(400);
  expect(mocks.scan).not.toHaveBeenCalled();
});
test('mapping review requires explicit confirmation and uses the current admin for audit', async () => {
  const body = {
    supplierId: 'supplier',
    supplierProductId: 'product',
    variantId: 'variant'
  };
  expect(
    (await PATCH(request({ ...body, reviewed: false }, 'PATCH'))).status
  ).toBe(400);
  expect(
    (await PATCH(request({ ...body, reviewed: true }, 'PATCH'))).status
  ).toBe(200);
  expect(mocks.map).toHaveBeenCalledWith({ ...body, reviewed: true }, 'admin');
});
test('approval requires a run ID and never accepts a client-supplied admin identity', async () => {
  const body = {
    supplierId: 'supplier',
    runId: '93cc612b-3f2c-4194-ae09-ea0d42f202b8',
    approve: true
  };
  expect(
    (await PATCH(request({ ...body, adminId: 'other' }, 'PATCH'))).status
  ).toBe(400);
  expect((await PATCH(request(body, 'PATCH'))).status).toBe(200);
  expect(mocks.approve).toHaveBeenCalledWith('supplier', body.runId, 'admin');
});
test('unexpected exceptions never expose secrets in API errors', async () => {
  mocks.scan.mockRejectedValueOnce(
    new Error('sensitive upstream request details')
  );
  const response = await POST(request({ supplierId: 'supplier' }));
  expect(await response.json()).toEqual({
    error: 'opportunities_request_failed'
  });
});

test('scan requests record the authenticated admin and missing schema returns a setup status', async () => {
  await POST(request({ supplierId: 'supplier' }));
  expect(mocks.scan).toHaveBeenCalledWith('supplier', 'admin');
  mocks.scan.mockRejectedValueOnce({
    code: 'P2021',
    message: 'private database details'
  });
  const response = await POST(request({ supplierId: 'supplier' }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: 'database_migration_required'
  });
});

test('Prisma initialization and raw-query failures return a safe database status', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const initialization = new Error('do not expose connection details');
  initialization.name = 'PrismaClientInitializationError';
  mocks.scan.mockRejectedValueOnce(initialization);
  const initializationResponse = await POST(request({ supplierId: 'asmodee' }));
  expect(initializationResponse.status).toBe(503);
  expect(await initializationResponse.json()).toEqual({ error: 'database_unavailable' });
  expect(log).toHaveBeenCalledWith('[api/opportunities] request failed', {
    operation: 'POST', name: 'PrismaClientInitializationError', code: null
  });

  mocks.scan.mockRejectedValueOnce({ code: 'P2010', message: 'private SQL and connection data' });
  const queryResponse = await POST(request({ supplierId: 'devir' }));
  expect(queryResponse.status).toBe(503);
  expect(await queryResponse.json()).toEqual({ error: 'database_unavailable' });
  expect(JSON.stringify(log.mock.calls)).not.toContain('connection data');
  log.mockRestore();
});
