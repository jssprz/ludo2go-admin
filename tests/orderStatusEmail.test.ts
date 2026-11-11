// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
import { orderEmailSender, sendOrderStatusNotification } from '../lib/order-status-email';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

test.each([
  [undefined, 'Jobys - Juegos de Mesa <no-reply@jobys.cl>'],
  ['  ', 'Jobys - Juegos de Mesa <no-reply@jobys.cl>'],
  ['no-reply@jobys.cl', 'Jobys - Juegos de Mesa <no-reply@jobys.cl>'],
  [' pedidos@jobys.cl ', 'Jobys - Juegos de Mesa <pedidos@jobys.cl>'],
  ['Jobys Pedidos <pedidos@jobys.cl>', 'Jobys Pedidos <pedidos@jobys.cl>'],
])('order email sender for %j is %s', (configured, expected) => {
  expect(orderEmailSender(configured)).toBe(expected);
});

test('status emails describe partial/full cancellations, gifts and added lines in HTML and text', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  mocks.send.mockResolvedValue({ error: null });
  await sendOrderStatusNotification({
    orderId: 'order-123456',
    customerEmail: 'customer@example.com',
    customerName: 'Ana',
    previousStatus: 'processing',
    status: 'ready_to_ship',
    total: 13000,
    currency: 'CLP',
    items: [
      { name: '<Game & One>', quantity: 3, unitPrice: 5000, isGift: false, cancellations: [
        { quantity: 1, reason: 'customer_request' },
      ] },
      { name: 'Cancelled game', quantity: 2, unitPrice: 9000, isGift: false, cancellations: [
        { quantity: 1, reason: 'damaged' }, { quantity: 1, reason: 'out_of_stock' },
      ] },
      { name: 'Bonus game', quantity: 1, unitPrice: 8000, isGift: true, cancellations: [] },
      { name: 'Additional game', quantity: 1, unitPrice: 3000, isGift: false, cancellations: [] },
    ],
  });
  const email = mocks.send.mock.calls[0][0];
  for (const body of [email.html, email.text]) {
    expect(body).toContain('Cantidad vigente: 2 de 3');
    expect(body).toContain('Cancelación parcial: 1 unidad(es)');
    expect(body).toContain('Cantidad vigente: 0 de 2');
    expect(body).toContain('Cancelado');
    expect(body).toContain('Producto dañado');
    expect(body).toContain('Sin stock');
    expect(body).toContain('Solicitado por el cliente');
    expect(body).toContain('Obsequio — Sin costo');
    expect(body).toContain('Additional game');
    expect(body).toContain('Total del producto:');
  }
  expect(email.html).toContain('&lt;Game &amp; One&gt;');
  expect(email.html).not.toContain('<Game & One>');
  expect(email.text).toContain('<Game & One>');
  expect(email.text).toContain(new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(10000));
  expect(email.text).not.toContain('reembolso');
});
