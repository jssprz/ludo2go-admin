// @vitest-environment node
import { expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { orderEmailSender } from '../lib/order-status-email';

test.each([
  [undefined, 'Jobys - Juegos de Mesa <no-reply@jobys.cl>'],
  ['  ', 'Jobys - Juegos de Mesa <no-reply@jobys.cl>'],
  ['no-reply@jobys.cl', 'Jobys - Juegos de Mesa <no-reply@jobys.cl>'],
  [' pedidos@jobys.cl ', 'Jobys - Juegos de Mesa <pedidos@jobys.cl>'],
  ['Jobys Pedidos <pedidos@jobys.cl>', 'Jobys Pedidos <pedidos@jobys.cl>'],
])('order email sender for %j is %s', (configured, expected) => {
  expect(orderEmailSender(configured)).toBe(expected);
});
