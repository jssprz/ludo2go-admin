import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PickupCoordinationButton } from '../app/(dashboard)/orders/[id]/pickup-coordination-button';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('requires confirmation and shows a successful delivery result', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: 'ok' }) });
  vi.stubGlobal('fetch', fetch);
  render(<PickupCoordinationButton orderId="order-1" email="customer@example.com" />);
  fireEvent.click(screen.getByRole('button', { name: 'Coordinar retiro por correo' }));
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText(/Enviar a customer@example.com/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Enviar correo' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('enviado'));
  expect(fetch).toHaveBeenCalledWith('/api/orders/order-1/pickup-coordination', { method: 'POST' });
});

test('shows provider failure and allows retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: 'No se pudo enviar' }) }));
  render(<PickupCoordinationButton orderId="order-1" email="customer@example.com" />);
  fireEvent.click(screen.getByRole('button', { name: 'Coordinar retiro por correo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Enviar correo' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo enviar'));
  expect(screen.getByRole('button', { name: 'Enviar correo' }).hasAttribute('disabled')).toBe(false);
});

test('disables sending when email is missing', () => {
  render(<PickupCoordinationButton orderId="order-1" email={null} />);
  expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
});
