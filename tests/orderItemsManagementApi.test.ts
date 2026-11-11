// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findOrder: vi.fn(),
  findCourier: vi.fn(),
  findVariant: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  updateOrder: vi.fn(),
  findResult: vi.fn(),
  history: vi.fn(),
  createItem: vi.fn(),
  findItem: vi.fn(),
  updateItem: vi.fn(),
  findItems: vi.fn(),
  createCancellation: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/order-status-email', () => ({ sendOrderStatusNotification: vi.fn() }));
vi.mock('@jssprz/ludo2go-database', () => ({
  prisma: {
    courier: { findUnique: mocks.findCourier },
    productVariant: { findUnique: mocks.findVariant },
    order: { findUnique: mocks.findOrder },
    $transaction: mocks.transaction,
  },
}));

import { PATCH } from '../app/api/orders/[id]/route';

const params = { params: Promise.resolve({ id: 'order-1' }) };
const baseOrder = {
  status: 'ready_to_ship',
  updatedAt: new Date('2026-11-11T16:00:00Z'),
  tax: 1900,
  shipping: 2000,
  promoDiscount: 500,
  currency: 'CLP',
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'admin-1' } });
  mocks.findOrder.mockResolvedValue(baseOrder);
  mocks.findCourier.mockResolvedValue({ id: 'courier-1' });
  mocks.findVariant.mockResolvedValue({ id: 'variant-1' });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.findItems.mockResolvedValue([
    { quantity: 2, unitPrice: 10000, isGift: false, cancellations: [] },
    { quantity: 1, unitPrice: 8000, isGift: true, cancellations: [] },
    { quantity: 3, unitPrice: 5000, isGift: false, cancellations: [{ quantity: 1 }] },
  ]);
  mocks.findResult.mockResolvedValue({
    id: 'order-1',
    status: 'ready_to_ship',
    total: 0,
    currency: 'CLP',
    customer: null,
    items: [],
  });
  mocks.transaction.mockImplementation(async (callback: any) => callback({
    order: {
      updateMany: mocks.updateMany,
      update: mocks.updateOrder,
      findUniqueOrThrow: mocks.findResult,
    },
    orderItem: {
      create: mocks.createItem,
      findFirst: mocks.findItem,
      update: mocks.updateItem,
      findMany: mocks.findItems,
    },
    orderItemCancellation: { create: mocks.createCancellation },
    orderStatusHistory: { create: mocks.history },
  }));
});

function patch(payload: unknown) {
  return PATCH(new Request('http://localhost/api/orders/order-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }), params);
}

test('adds an item and recalculates subtotal/total from active non-gift quantities', async () => {
  const response = await patch({
    addItem: { variantId: '5fa4e118-73d4-4a1f-b5c8-2af676704f95', quantity: 2, unitPrice: 12000, isGift: true, giftReason: 'Customer apology' },
  });
  expect(response.status).toBe(200);
  expect(mocks.createItem).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      orderId: 'order-1',
      quantity: 2,
      unitPrice: 12000,
      isGift: true,
      giftReason: 'Customer apology',
      giftedBy: 'admin-1',
    }),
  }));
  expect(mocks.updateOrder).toHaveBeenCalledWith({
    where: { id: 'order-1' },
    data: {
      subtotal: 30000,
      total: 33400,
      updatedAt: expect.any(Date),
    },
  });
});

test('creates a cancellation row and blocks cancellation above remaining quantity', async () => {
  mocks.findItem.mockResolvedValue({ id: 'item-1', quantity: 3, cancellations: [{ quantity: 2 }] });
  expect((await patch({
    cancelItem: {
      orderItemId: '5fa4e118-73d4-4a1f-b5c8-2af676704f95',
      quantity: 1,
      reason: 'customer_request',
    },
  })).status).toBe(200);
  expect(mocks.createCancellation).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      orderItemId: 'item-1',
      quantity: 1,
      reason: 'customer_request',
      actorType: 'ADMIN',
      actorId: 'admin-1',
    }),
  }));

  mocks.findItem.mockResolvedValue({ id: 'item-1', quantity: 3, cancellations: [{ quantity: 3 }] });
  expect((await patch({
    cancelItem: {
      orderItemId: '5fa4e118-73d4-4a1f-b5c8-2af676704f95',
      quantity: 1,
      reason: 'other',
    },
  })).status).toBe(400);
});

test('toggles gift metadata and validates request shape', async () => {
  mocks.findItem.mockResolvedValue({ id: 'item-1' });
  expect((await patch({
    giftItem: { orderItemId: '5fa4e118-73d4-4a1f-b5c8-2af676704f95', isGift: true, giftReason: 'Promo' },
  })).status).toBe(200);
  expect(mocks.updateItem).toHaveBeenCalledWith({
    where: { id: 'item-1' },
    data: expect.objectContaining({
      isGift: true,
      giftReason: 'Promo',
      giftedBy: 'admin-1',
      giftedAt: expect.any(Date),
    }),
  });

  expect((await patch({
    giftItem: { orderItemId: '5fa4e118-73d4-4a1f-b5c8-2af676704f95', isGift: true },
  })).status).toBe(400);
  expect((await patch({
    addItem: { variantId: '5fa4e118-73d4-4a1f-b5c8-2af676704f95', quantity: 1, unitPrice: 1000 },
    cancelItem: { orderItemId: '5fa4e118-73d4-4a1f-b5c8-2af676704f95', quantity: 1, reason: 'other' },
  })).status).toBe(400);
});
