// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(), auth: vi.fn(), findOrder: vi.fn(), transaction: vi.fn(), findHistory: vi.fn(),
  updateHistory: vi.fn(), createHistory: vi.fn(), put: vi.fn(), get: vi.fn(), del: vi.fn(), oidc: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@vercel/blob', () => ({ put: mocks.put, get: mocks.get, del: mocks.del }));
vi.mock('@vercel/oidc', () => ({ getVercelOidcToken: mocks.oidc }));
vi.mock('@jssprz/ludo2go-database', () => ({ prisma: {
  order: { findUnique: mocks.findOrder }, $transaction: mocks.transaction,
} }));

import { GET, POST } from '../app/api/orders/[id]/delivery-proof/route';

const params = { params: Promise.resolve({ id: 'order-1' }) };

function upload(file: Blob | null) {
  const body = new FormData();
  if (file) body.append('photo', file, 'photo.jpg');
  return new Request('http://localhost/api/orders/order-1/delivery-proof', { method: 'POST', body });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.SENSITIVE_BLOB_STORE_ID = 'store_private';
  mocks.auth.mockResolvedValue({ user: { id: 'admin-1' } });
  mocks.oidc.mockResolvedValue('oidc-token');
  mocks.findOrder.mockResolvedValue({ status: 'delivered' });
  mocks.put.mockImplementation(async (pathname: string) => ({ pathname, url: `https://blob/${pathname}` }));
  mocks.findHistory.mockResolvedValue({ id: 'history-1', metadata: { foo: 'bar' } });
  mocks.transaction.mockImplementation(async (callback) => callback({
    orderStatusHistory: { findFirst: mocks.findHistory, update: mocks.updateHistory, create: mocks.createHistory },
  }));
});

test('uploads to the private store with explicit OIDC credentials and appends to delivered history', async () => {
  const response = await POST(upload(new Blob(['img'], { type: 'image/jpeg' })), params);
  expect(response.status).toBe(201);
  const [pathname, , options] = mocks.put.mock.calls[0];
  expect(pathname).toMatch(/^orders\/order-1\/delivery-proof\/\d+-[0-9a-f-]+\.jpg$/);
  expect(options).toMatchObject({ access: 'private', storeId: 'store_private', oidcToken: 'oidc-token', contentType: 'image/jpeg' });
  expect(mocks.updateHistory).toHaveBeenCalledWith({
    where: { id: 'history-1' },
    data: { metadata: { foo: 'bar', deliveryProofs: [expect.objectContaining({ pathname, uploadedBy: 'admin-1', size: 3 })] } },
  });
});

test('creates a delivered history entry when none exists', async () => {
  mocks.findHistory.mockResolvedValue(null);
  expect((await POST(upload(new Blob(['img'], { type: 'image/png' })), params)).status).toBe(201);
  expect(mocks.createHistory.mock.calls[0][0].data).toMatchObject({ orderId: 'order-1', fromStatus: 'delivered', toStatus: 'delivered' });
});

test('never falls back to the public store when private credentials are missing', async () => {
  mocks.oidc.mockRejectedValue(new Error('no token'));
  expect((await POST(upload(new Blob(['img'], { type: 'image/jpeg' })), params)).status).toBe(503);
  delete process.env.SENSITIVE_BLOB_STORE_ID;
  mocks.oidc.mockResolvedValue('oidc-token');
  expect((await POST(upload(new Blob(['img'], { type: 'image/jpeg' })), params)).status).toBe(503);
  expect(mocks.put).not.toHaveBeenCalled();
});

test.each([
  ['unauthenticated', () => mocks.auth.mockResolvedValue(null), 401],
  ['non-delivered order', () => mocks.findOrder.mockResolvedValue({ status: 'shipped' }), 400],
  ['missing order', () => mocks.findOrder.mockResolvedValue(null), 404],
])('rejects %s before uploading', async (_, setup, status) => {
  setup();
  expect((await POST(upload(new Blob(['img'], { type: 'image/jpeg' })), params)).status).toBe(status);
  expect(mocks.put).not.toHaveBeenCalled();
});

test('rejects non-image and empty uploads', async () => {
  expect((await POST(upload(new Blob(['x'], { type: 'text/html' })), params)).status).toBe(400);
  expect((await POST(upload(null), params)).status).toBe(400);
  expect(mocks.put).not.toHaveBeenCalled();
});

test('deletes the uploaded blob if recording it fails', async () => {
  mocks.updateHistory.mockRejectedValue(new Error('db down'));
  mocks.del.mockResolvedValue(undefined);
  await expect(POST(upload(new Blob(['img'], { type: 'image/jpeg' })), params)).rejects.toThrow('db down');
  expect(mocks.del).toHaveBeenCalledWith(expect.stringContaining('orders/order-1/delivery-proof/'), expect.objectContaining({ storeId: 'store_private' }));
});

test('GET only serves photos under the order prefix from the private store', async () => {
  const bad = new Request('http://localhost/api/orders/order-1/delivery-proof?pathname=orders/order-2/delivery-proof/a.jpg');
  expect((await GET(bad, params)).status).toBe(400);
  const traversal = new Request('http://localhost/api/orders/order-1/delivery-proof?pathname=orders/order-1/delivery-proof/../../x');
  expect((await GET(traversal, params)).status).toBe(400);

  mocks.get.mockResolvedValue({ statusCode: 200, stream: new Blob(['img']).stream(), blob: { contentType: 'image/jpeg' } });
  const ok = new Request('http://localhost/api/orders/order-1/delivery-proof?pathname=orders/order-1/delivery-proof/1-a.jpg');
  const response = await GET(ok, params);
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mocks.get).toHaveBeenCalledWith('orders/order-1/delivery-proof/1-a.jpg', expect.objectContaining({ access: 'private', storeId: 'store_private' }));
});

