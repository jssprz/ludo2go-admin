// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), order: vi.fn(), send: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@jssprz/ludo2go-database', () => ({ prisma: { order: { findUnique: mocks.order } } }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));

import { POST } from '../app/api/orders/[id]/pickup-coordination/route';

const context = { params: Promise.resolve({ id: 'order-123456' }) };
const request = () => new Request('http://localhost/api/orders/order-123456/pickup-coordination', { method: 'POST' });
const order = {
  id: 'order-123456',
  fulfillmentMethod: 'pickup',
  status: 'processing',
  customer: { email: 'customer@example.com', firstName: '<Ana>', lastName: null },
  pickupLocation: {
    name: 'Local <Centro>', addressLine1: 'Calle 123', addressLine2: null,
    city: 'Santiago', region: null, country: 'Chile', description: 'Previa coordinación',
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM_EMAIL', 'pedidos@jobys.cl');
  mocks.auth.mockResolvedValue({ user: { id: 'admin-1' } });
  mocks.order.mockResolvedValue(order);
  mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

test('sends Spanish pickup coordination with selected location and WhatsApp without a customer phone', async () => {
  expect((await POST(request(), context)).status).toBe(200);
  const email = mocks.send.mock.calls[0][0];
  expect(email.to).toBe('customer@example.com');
  expect(email.from).toBe('Jobys - Juegos de Mesa <pedidos@jobys.cl>');
  for (const body of [email.text, email.html]) {
    expect(body).toContain('seleccionaste retiro en tienda');
    expect(body).toContain('día y horario');
    expect(body).toContain('+56 9 9542 5099');
    expect(body).toContain('Calle 123');
    expect(body).toContain('https://wa.me/56995425099?text=');
    expect(body).toContain('no respondas');
    expect(body).toContain('Espera nuestra confirmación');
  }
  expect(email.html).toContain('&lt;Ana&gt;');
  expect(email.html).toContain('Local &lt;Centro&gt;');
  expect(decodeURIComponent(email.text)).toContain('pedido #order-12');
});

test('requires authentication before loading order or sending email', async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await POST(request(), context)).status).toBe(401);
  expect(mocks.order).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});

test.each([
  [null, 404],
  [{ ...order, fulfillmentMethod: 'delivery' }, 400],
  [{ ...order, status: 'cancelled' }, 400],
  [{ ...order, status: 'delivered' }, 400],
  [{ ...order, customer: { ...order.customer, email: '' } }, 400],
])('rejects an ineligible order without sending', async (value, expected) => {
  mocks.order.mockResolvedValue(value);
  expect((await POST(request(), context)).status).toBe(expected);
  expect(mocks.send).not.toHaveBeenCalled();
});

test('supports pickup orders without a stored pickup location', async () => {
  mocks.order.mockResolvedValue({ ...order, pickupLocation: null });
  expect((await POST(request(), context)).status).toBe(200);
  expect(mocks.send.mock.calls[0][0].text).toContain('confirmar los detalles');
});

test('reports provider failures instead of claiming success', async () => {
  mocks.send.mockResolvedValue({ data: null, error: { message: 'Provider failure' } });
  const response = await POST(request(), context);
  expect(response.status).toBe(500);
  expect((await response.json()).message).toContain('No se pudo enviar');
  expect(console.error).toHaveBeenCalled();
});

test('reports missing email configuration without attempting delivery', async () => {
  vi.stubEnv('RESEND_API_KEY', '');
  expect((await POST(request(), context)).status).toBe(500);
  expect(mocks.send).not.toHaveBeenCalled();
});

const previewRequest = () => new Request('http://localhost/api/orders/order-123456/pickup-coordination?preview=true', { method: 'POST' });

test('preview sends identical content exclusively to the authenticated admin', async () => {
  await POST(request(), context);
  const customerEmail = mocks.send.mock.calls[0][0];
  mocks.send.mockClear();
  mocks.auth.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
  const response = await POST(previewRequest(), context);
  expect(response.status).toBe(200);
  expect((await response.json()).message).toContain('No se envió al cliente');
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.send.mock.calls[0][0]).toEqual({ ...customerEmail, to: 'admin@example.com' });
});

test('preview works without customer email', async () => {
  mocks.auth.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
  mocks.order.mockResolvedValue({ ...order, customer: { ...order.customer, email: '' } });
  expect((await POST(previewRequest(), context)).status).toBe(200);
  expect(mocks.send.mock.calls[0][0].to).toBe('admin@example.com');
});

test('preview without admin email never falls back to the customer', async () => {
  expect((await POST(previewRequest(), context)).status).toBe(400);
  expect(mocks.send).not.toHaveBeenCalled();
});
