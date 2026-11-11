import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { OrderItemsControl } from '../app/(dashboard)/orders/[id]/order-items-control';

beforeEach(() => {
  vi.resetAllMocks();
});

test('sends cancellation payload for an order item', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);

  render(
    <OrderItemsControl
      orderId="order-1"
      currency="CLP"
      items={[{ id: 'item-1', quantity: 3, unitPrice: 1000, isGift: false, giftReason: null, cancelledQuantity: 1 }]}
    />
  );

  await user.clear(screen.getByRole('spinbutton', { name: 'Cancel qty' }));
  await user.type(screen.getByRole('spinbutton', { name: 'Cancel qty' }), '2');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Reason' }), 'damaged');
  await user.type(screen.getByRole('textbox', { name: 'Details (optional)' }), 'Box crushed');
  await user.click(screen.getByRole('button', { name: 'Cancel units' }));

  expect(fetchMock).toHaveBeenCalledWith('/api/orders/order-1', expect.objectContaining({
    method: 'PATCH',
    body: JSON.stringify({
      cancelItem: {
        orderItemId: 'item-1',
        quantity: 2,
        reason: 'damaged',
        details: 'Box crushed',
      },
    }),
  }));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});
