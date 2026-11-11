import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { DeliveryProofCapture } from '../app/(dashboard)/orders/[id]/delivery-proof-capture';
import { OrderStatusControl } from '../app/(dashboard)/orders/[id]/order-status-control';

beforeEach(() => { vi.resetAllMocks(); });

test('camera button only appears for delivered orders', () => {
  const { rerender } = render(<OrderStatusControl orderId="order-1" status="shipped" />);
  expect(screen.queryByRole('button', { name: /delivery photo/i })).toBeNull();
  rerender(<OrderStatusControl orderId="order-1" status="delivered" />);
  expect(screen.getByRole('button', { name: /take delivery photo/i })).toBeTruthy();
  expect(screen.getByLabelText('Delivery photo').getAttribute('capture')).toBe('environment');
  expect(screen.getByRole('button', { name: /upload from device/i })).toBeTruthy();
  expect(screen.getByLabelText('Delivery photo file').hasAttribute('capture')).toBe(false);
});

test('captured photo is uploaded and the page refreshed', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<DeliveryProofCapture orderId="order-1" proofs={[{ pathname: 'orders/order-1/delivery-proof/1-a.jpg', uploadedAt: '2026-11-11T00:00:00Z' }]} />);
  expect(screen.getByAltText('Delivery proof').getAttribute('src')).toBe('/api/orders/order-1/delivery-proof?pathname=orders%2Forder-1%2Fdelivery-proof%2F1-a.jpg');

  await userEvent.upload(screen.getByLabelText('Delivery photo'), new File(['img'], 'p.jpg', { type: 'image/jpeg' }));
  await screen.findByText('Delivery photo saved.');
  expect(fetchMock).toHaveBeenCalledWith('/api/orders/order-1/delivery-proof', expect.objectContaining({ method: 'POST', body: expect.any(FormData) }));
  expect(mocks.refresh).toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test('photo picked from existing device files is uploaded', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<DeliveryProofCapture orderId="order-1" proofs={[]} />);
  await userEvent.upload(screen.getByLabelText('Delivery photo file'), new File(['img'], 'gallery.png', { type: 'image/png' }));
  await screen.findByText('Delivery photo saved.');
  expect(fetchMock).toHaveBeenCalledWith('/api/orders/order-1/delivery-proof', expect.objectContaining({ method: 'POST' }));
});
