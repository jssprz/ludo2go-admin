import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import type { OrderStatus } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(), auth: vi.fn(), findOrder: vi.fn(), findCourier: vi.fn(), update: vi.fn(), result: vi.fn(), history: vi.fn(), transaction: vi.fn(), email: vi.fn()
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/order-status-email', () => ({ sendOrderStatusNotification: mocks.email }));
vi.mock('@jssprz/ludo2go-database', () => ({ prisma: {
  courier: { findUnique: mocks.findCourier },
  order: { findUnique: mocks.findOrder }, $transaction: mocks.transaction
} }));

import { PATCH } from '../app/api/orders/[id]/route';
import { OrderStatusControl } from '../app/(dashboard)/orders/[id]/order-status-control';

const updatedAt = new Date('2026-10-14T10:00:00Z');
const params = { params: Promise.resolve({ id: 'order-1' }) };
const order = {
  id: 'order-1', status: 'ready_to_ship' as OrderStatus, courierTrackingNumber: 'OLD',
  total: 10000, currency: 'CLP', items: [],
  customer: { email: 'customer@example.com', firstName: 'Ana', lastName: null }
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'admin-1' } });
  mocks.findCourier.mockResolvedValue({ id: '91ba0dee-a86c-4c30-b926-06f80baaf51b' });
  mocks.findOrder.mockResolvedValue({ status: 'ready_to_ship', updatedAt });
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.result.mockResolvedValue(order);
  mocks.email.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback) => callback({
    order: { updateMany: mocks.update, findUniqueOrThrow: mocks.result },
    orderStatusHistory: { create: mocks.history }
  }));
});

function request(payload: unknown) {
  return new Request('http://localhost/api/orders/order-1', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
}

test.each(['ready_to_ship', 'shipped', 'delivered', 'cancelled'] as const)('API supports tracking-only edits in %s without status history or email', async (status) => {
  mocks.findOrder.mockResolvedValue({ status, updatedAt });
  mocks.result.mockResolvedValue({ ...order, status, courierTrackingNumber: 'TRACK-123' });
  expect((await PATCH(request({ courierTrackingNumber: '  TRACK-123  ' }), params)).status).toBe(200);
  expect(mocks.update.mock.calls[0][0]).toMatchObject({
    where: { id: 'order-1', status, updatedAt }, data: { status, courierTrackingNumber: 'TRACK-123' }
  });
  expect(mocks.history).not.toHaveBeenCalled();
  expect(mocks.email).not.toHaveBeenCalled();
});

test.each(['pending', 'confirmed', 'processing'] as const)('API rejects tracking in %s before writing', async (status) => {
  mocks.findOrder.mockResolvedValue({ status, updatedAt });
  expect((await PATCH(request({ courierTrackingNumber: 'TRACK' }), params)).status).toBe(400);
  expect(mocks.transaction).not.toHaveBeenCalled();
});

test('status and tracking can be updated atomically when transitioning into ready_to_ship', async () => {
  mocks.findOrder.mockResolvedValue({ status: 'processing', updatedAt });
  expect((await PATCH(request({ status: 'ready_to_ship', courierTrackingNumber: 'TRACK' }), params)).status).toBe(200);
  expect(mocks.update.mock.calls[0][0].data).toMatchObject({ status: 'ready_to_ship', courierTrackingNumber: 'TRACK' });
  expect(mocks.history).toHaveBeenCalledTimes(1);
  expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({ previousStatus: 'processing', status: 'ready_to_ship' }));
});

test('status-only requests preserve tracking and blank tracking clears it', async () => {
  expect((await PATCH(request({ status: 'ready_to_ship' }), params)).status).toBe(200);
  expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty('courierTrackingNumber');
  expect((await PATCH(request({ courierTrackingNumber: '  ' }), params)).status).toBe(200);
  expect(mocks.update.mock.calls[1][0].data.courierTrackingNumber).toBeNull();
});

test('tracking changes cannot accompany a transition back to processing', async () => {
  expect((await PATCH(request({ status: 'processing', courierTrackingNumber: 'TRACK' }), params)).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});

test('invalid payloads and malformed JSON return 400, missing authentication returns 401', async () => {
  for (const payload of [{}, { courierTrackingNumber: 123 }, { status: 'unknown' }, null]) {
    expect((await PATCH(request(payload), params)).status).toBe(400);
  }
  expect((await PATCH(new Request('http://localhost/api/orders/order-1', { method: 'PATCH', body: '{' }), params)).status).toBe(400);
  mocks.auth.mockResolvedValue({ user: {} });
  expect((await PATCH(request({ courierTrackingNumber: 'TRACK' }), params)).status).toBe(401);
  expect(mocks.update).not.toHaveBeenCalled();
});

test('concurrent order updates return 409 without history or notifications', async () => {
  mocks.update.mockResolvedValue({ count: 0 });
  expect((await PATCH(request({ courierTrackingNumber: 'TRACK' }), params)).status).toBe(409);
  expect(mocks.result).not.toHaveBeenCalled();
  expect(mocks.history).not.toHaveBeenCalled();
  expect(mocks.email).not.toHaveBeenCalled();
});

test.each(['ready_to_ship', 'shipped', 'delivered', 'cancelled'] as const)('detail UI saves tracking for %s and refreshes the order', async (status) => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ status, courierTrackingNumber: 'NEW' }));
  vi.stubGlobal('fetch', fetchMock);
  render(<OrderStatusControl orderId="order-1" status={status} courierTrackingNumber="OLD" />);
  await user.clear(screen.getByRole('textbox', { name: 'Courier tracking number' }));
  await user.type(screen.getByRole('textbox', { name: 'Courier tracking number' }), 'NEW');
  await user.click(screen.getByRole('button', { name: 'Save tracking' }));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ courierTrackingNumber: 'NEW' });
  expect(screen.getByText('Tracking number saved.')).toBeTruthy();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

test('choosing ready_to_ship exposes tracking after a successful status save', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'ready_to_ship', courierTrackingNumber: null }));
  vi.stubGlobal('fetch', fetchMock);
  render(<OrderStatusControl orderId="order-1" status="processing" />);
  expect(screen.queryByRole('textbox', { name: 'Courier tracking number' })).toBeNull();
  await user.click(screen.getByRole('combobox', { name: 'Change order status' }));
  await user.click(screen.getByRole('option', { name: 'ready_to_ship' }));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: 'ready_to_ship' });
  expect(screen.getByRole('textbox', { name: 'Courier tracking number' })).toBeTruthy();
});

test('double clicks during a tracking save send one request and failures retain the draft', async () => {
  const user = userEvent.setup();
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>((fulfill) => { resolve = fulfill; });
  const fetchMock = vi.fn().mockReturnValue(pending);
  vi.stubGlobal('fetch', fetchMock);
  render(<OrderStatusControl orderId="order-1" status="shipped" courierTrackingNumber="OLD" />);
  await user.clear(screen.getByRole('textbox', { name: 'Courier tracking number' }));
  await user.type(screen.getByRole('textbox', { name: 'Courier tracking number' }), 'NEW');
  await user.dblClick(screen.getByRole('button', { name: 'Save tracking' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(Response.json({ message: 'Save failed' }, { status: 500 })); });
  expect(screen.getByRole('alert').textContent).toBe('Save failed');
  expect((screen.getByRole('textbox', { name: 'Courier tracking number' }) as HTMLInputElement).value).toBe('NEW');
  expect(mocks.refresh).not.toHaveBeenCalled();
});

const courierId = '91ba0dee-a86c-4c30-b926-06f80baaf51b';
const couriers = [{ id: courierId, name: 'Test Courier', trackingUrlTemplate: 'https://courier.test/{trackingNumber}' }];

test('API saves courier and tracking together and allows clearing the courier', async () => {
  expect((await PATCH(request({ courierId, courierTrackingNumber: 'AB/12' }), params)).status).toBe(200);
  expect(mocks.update.mock.calls[0][0].data).toMatchObject({ courierId, courierTrackingNumber: 'AB/12' });
  expect((await PATCH(request({ courierId: null }), params)).status).toBe(200);
  expect(mocks.update.mock.calls[1][0].data).toMatchObject({ courierId: null });
  expect(mocks.update.mock.calls[1][0].data).not.toHaveProperty('courierTrackingNumber');
  expect(mocks.history).not.toHaveBeenCalled();
  expect(mocks.email).not.toHaveBeenCalled();
});

test('API rejects missing couriers, invalid IDs and courier edits before ready_to_ship', async () => {
  mocks.findCourier.mockResolvedValue(null);
  expect((await PATCH(request({ courierId }), params)).status).toBe(400);
  expect((await PATCH(request({ courierId: 'invalid' }), params)).status).toBe(400);
  mocks.findOrder.mockResolvedValue({ status: 'processing', updatedAt });
  expect((await PATCH(request({ courierId: null }), params)).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});

test('UI selects a courier and only shows the final encoded link after saving', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'shipped', courierId, courierTrackingNumber: 'AB/12' }));
  vi.stubGlobal('fetch', fetchMock);
  render(<OrderStatusControl orderId="order-1" status="shipped" couriers={couriers} />);
  await user.click(screen.getByRole('combobox', { name: /^Courier$/ }));
  await user.click(screen.getByRole('option', { name: 'Test Courier' }));
  await user.type(screen.getByRole('textbox', { name: 'Courier tracking number' }), 'AB/12');
  expect(screen.queryByRole('link', { name: 'https://courier.test/AB%2F12' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Save tracking' }));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ courierId, courierTrackingNumber: 'AB/12' });
  expect(screen.getByRole('link', { name: 'https://courier.test/AB%2F12' }).getAttribute('href')).toBe('https://courier.test/AB%2F12');
});

test('UI retains the saved link while editing and hides it when the courier is cleared', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'shipped', courierId: null, courierTrackingNumber: 'NEW' })));
  render(<OrderStatusControl orderId="order-1" status="shipped" courierId={courierId} courierTrackingNumber="OLD" couriers={couriers} />);
  await user.clear(screen.getByRole('textbox', { name: 'Courier tracking number' }));
  await user.type(screen.getByRole('textbox', { name: 'Courier tracking number' }), 'NEW');
  expect(screen.getByRole('link', { name: 'https://courier.test/OLD' })).toBeTruthy();
  await user.click(screen.getByRole('combobox', { name: /^Courier$/ }));
  await user.click(screen.getByRole('option', { name: 'No courier' }));
  await user.click(screen.getByRole('button', { name: 'Save tracking' }));
  expect(screen.queryByRole('link', { name: /https:\/\/courier.test/ })).toBeNull();
});