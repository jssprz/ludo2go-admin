// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  send: vi.fn(), order: vi.fn(), createToken: vi.fn(), revokeToken: vi.fn(), template: vi.fn(),
}));
vi.mock('@jssprz/ludo2go-database', () => ({ prisma: {
  order: { findUnique: mocks.order },
  emailTemplate: { findUnique: mocks.template },
  emailVerificationToken: { create: mocks.createToken, update: mocks.revokeToken },
} }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
import { orderEmailSender, sendOrderStatusNotification } from '../lib/order-status-email';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.order.mockResolvedValue({
    id: 'order-123456', customerId: 'customer-1', customer: { email: 'stored@example.com' },
  });
  mocks.template.mockResolvedValue(null);
  mocks.createToken.mockResolvedValue({ id: 'token-1' });
  mocks.revokeToken.mockResolvedValue({});
});

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
    customerName: 'Ana',
    previousStatus: 'processing',
    status: 'ready_to_ship',
    fulfillmentMethod: 'pickup',
    total: 13000,
    currency: 'CLP',
    items: [
      {
        name: '<Game & One>',
        quantity: 3,
        unitPrice: 5000,
        isGift: false,
        imageUrl: 'https://images.example.com/game.jpg?size=small&fit=cover',
        cancellations: [{ quantity: 1, reason: 'customer_request' }],
      },
      { name: 'Cancelled game', quantity: 2, unitPrice: 9000, isGift: false, imageUrl: 'javascript:alert(1)', cancellations: [
        { quantity: 1, reason: 'damaged' }, { quantity: 1, reason: 'out_of_stock' },
      ] },
      { name: 'Bonus game', quantity: 1, unitPrice: 8000, isGift: true, cancellations: [] },
      { name: 'Additional game', quantity: 1, unitPrice: 3000, isGift: false, cancellations: [] },
    ],
    payments: [{ method: 'card', status: 'captured' }],
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
  expect(email.html).toContain('jobys-logo-transparent-no-shadow-cropped.png');
  expect(email.html).toContain('src="https://images.example.com/game.jpg?size=small&amp;fit=cover"');
  expect(email.html).not.toContain('javascript:alert(1)');
  expect(email.html).toContain('Información de pago');
  expect(email.html).toContain('Método de entrega:</strong> Retiro en tienda');
  expect(email.html).toContain('Tarjeta — Pagado');
  expect(email.html).toContain('Jobys protege tu seguridad y privacidad.');
  expect(email.html).toContain('Este buzón no está monitoreado.');
  expect(email.html).toContain(`© ${new Date().getFullYear()} Jobys. Todos los derechos reservados.`);
  expect(email.text).toContain('<Game & One>');
  expect(email.text).toContain('Método de pago: Tarjeta — Pagado');
  expect(email.text).toContain('Método de entrega: Retiro en tienda');
  expect(email.text).toContain('Jobys protege tu seguridad y privacidad.');
  expect(email.text).toContain('Este buzón no está monitoreado.');
  expect(email.text).toContain(new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(10000));
  expect(email.text).not.toContain('reembolso');
  expect(email.to).toEqual(['stored@example.com']);
  const link = email.text.match(/https:\/\/jobys\.cl\/api\/orders\/order-123456\/access\?token=([a-f0-9]{64})/);
  expect(link).not.toBeNull();
  const secret = link![1];
  const data = mocks.createToken.mock.calls[0][0].data;
  expect(data.token).toBe(`order_access_order-123456_${createHash('sha256').update(secret).digest('hex')}`);
  expect(data.token).not.toContain(secret);
  expect(data).toMatchObject({ customerId: 'customer-1', email: 'stored@example.com', used: false });
  expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60 * 1000);
  expect(data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 90 * 24 * 60 * 60 * 1000);
  expect(email.html).toContain(`href="${link![0]}" style=`);
  expect(mocks.revokeToken).not.toHaveBeenCalled();
});

const notification = {
  orderId: 'order-123456', previousStatus: 'processing' as const, status: 'shipped' as const,
  fulfillmentMethod: 'delivery' as const, total: 10000, currency: 'CLP', items: [],
};

test.each(['returned', 'thrown'])('revokes only the new token on a %s send failure without logging secrets', async (failure) => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  if (failure === 'returned') mocks.send.mockResolvedValue({ error: { message: 'Sensitive provider payload' } });
  else mocks.send.mockRejectedValue(new Error('Sensitive provider payload'));
  try {
    await sendOrderStatusNotification(notification);
    expect(mocks.revokeToken).toHaveBeenCalledExactlyOnceWith({
      where: { id: 'token-1' }, data: { used: true, usedAt: expect.any(Date) },
    });
    expect(log).toHaveBeenCalledExactlyOnceWith('Order status email failed.');
  } finally {
    log.mockRestore();
  }
});

test('new emails issue independent tokens without revoking earlier links', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  mocks.send.mockResolvedValue({ error: null });
  await sendOrderStatusNotification(notification);
  await sendOrderStatusNotification(notification);
  expect(mocks.createToken).toHaveBeenCalledTimes(2);
  expect(mocks.createToken.mock.calls[0][0].data.token).not.toBe(mocks.createToken.mock.calls[1][0].data.token);
  expect(mocks.revokeToken).not.toHaveBeenCalled();
});

test('does not send an email when token creation fails', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  mocks.createToken.mockRejectedValue(new Error('database unavailable'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await sendOrderStatusNotification(notification);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.revokeToken).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledExactlyOnceWith('Order status email failed.');
  } finally {
    log.mockRestore();
  }
});

const storedTemplate = {
  subjectTemplate: 'Pedido #{{orderNumber}}: {{statusLabel}}',
  htmlTemplate: '<p>Hola {{customerName}}</p>{{#each itemSummaries}}<b>{{name}}</b>{{#each details}}{{this}}{{#unless @last}}<br>{{/unless}}{{/each}}{{else}}vacío{{/each}}<a href="{{orderUrl}}">Ver</a>',
  textTemplate: 'Hola {{customerName}} {{#each itemSummaries}}{{name}}{{/each}} {{orderUrl}}',
  fromName: 'Jobys - Juegos de Mesa',
  fromEmail: null,
  replyToEmail: 'ayuda@jobys.cl',
};

test('renders the stored template, escaping HTML only, and keeps token, recipient, tags and configured sender', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM_EMAIL', 'Jobys Pedidos <pedidos@jobys.cl>');
  mocks.template.mockResolvedValue(storedTemplate);
  mocks.send.mockResolvedValue({ error: null });
  await sendOrderStatusNotification({
    ...notification,
    customerName: ' <Ana> ',
    items: [{ name: '<Game & One>', quantity: 1, unitPrice: 10000, isGift: false, cancellations: [] }],
  });
  expect(mocks.template).toHaveBeenCalledWith({ where: { key_locale: { key: 'order_status_update', locale: 'es-CL' } } });
  const email = mocks.send.mock.calls[0][0];
  expect(email.subject).toBe('Pedido #order-12: enviado');
  expect(email.html).toContain('Hola &lt;Ana&gt;');
  expect(email.html).toContain('&lt;Game &amp; One&gt;');
  expect(email.text).toContain('Hola <Ana> <Game & One>');
  expect(email.from).toBe('Jobys Pedidos <pedidos@jobys.cl>');
  expect(email.replyTo).toBe('ayuda@jobys.cl');
  expect(email.to).toEqual(['stored@example.com']);
  expect(email.tags).toEqual([
    { name: 'type', value: 'order_status_update' },
    { name: 'order_status', value: 'shipped' },
  ]);
  const secret = email.text.match(/token=([a-f0-9]{64})/)![1];
  expect(email.html).toContain(`https://jobys.cl/api/orders/order-123456/access?token&#x3D;${secret}`);
  expect(mocks.createToken).toHaveBeenCalledOnce();
});

test.each([
  ['missing', () => mocks.template.mockResolvedValue(null)],
  ['unreadable', () => mocks.template.mockRejectedValue(new Error('db'))],
  ['invalid', () => mocks.template.mockResolvedValue({ ...storedTemplate, htmlTemplate: '{{{raw}}}' })],
])('falls back to built-in content when the template is %s', async (_name, arrange) => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  arrange();
  mocks.send.mockResolvedValue({ error: null });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await sendOrderStatusNotification(notification);
  } finally {
    log.mockRestore();
  }
  const email = mocks.send.mock.calls[0][0];
  expect(email.html).toContain('Actualización de tu pedido');
  expect(email.from).toBe('Jobys - Juegos de Mesa <no-reply@jobys.cl>');
  expect(email.replyTo).toBeUndefined();
});
