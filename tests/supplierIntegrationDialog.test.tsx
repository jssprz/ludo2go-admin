import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { SupplierIntegrationDialog } from '../app/(dashboard)/suppliers/supplier-integration-dialog';
import messages from '../messages/en.json';

const fetchMock = vi.fn();
const close = vi.fn();
const draft = {
  updatedAt: '2026-10-18T00:00:00.000Z', adapterKey: 'devir', baseUrl: '', authMethod: 'form',
  usernameSecretRef: null, passwordSecretRef: null, sessionSecretRef: null,
  browserSecretRef: null, browserRendering: false, taxTreatment: 'unconfirmed',
  taxVerifiedAt: null, integrationVerifiedAt: null, isEnabled: false, config: {}
};
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }); }
function mount() {
  return render(<NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}><SupplierIntegrationDialog supplier={{ id: 'fixture', name: 'Fixture supplier' }} onClose={close} /></NextIntlClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(response({ integration: null, configVersion: null }));
});
test('loads and saves an incomplete disabled draft with reference names, preserving server revision', async () => {
  mount();
  const reference = await screen.findByLabelText('Username environment reference');
  expect(reference.getAttribute('type')).not.toBe('password');
  fireEvent.change(reference, { target: { value: 'SUPPLIER_DEVIR_USERNAME' } });
  fetchMock.mockResolvedValueOnce(response({ integration: { ...draft, usernameSecretRef: 'SUPPLIER_DEVIR_USERNAME' }, configVersion: 1 }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('Integration saved.');
  const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(payload).toMatchObject({ isEnabled: false, usernameSecretRef: 'SUPPLIER_DEVIR_USERNAME', updatedAt: null, config: {}, integrationVerifiedAt: null });
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
});
test('JSON errors stay local and raw API details are not rendered', async () => {
  mount();
  const config = await screen.findByLabelText('Verification and catalog JSON');
  fireEvent.change(config, { target: { value: '{' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('Enter valid JSON before saving.');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(config, { target: { value: '{}' } });
  fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'https://btb.devir.cl' } });
  fetchMock.mockResolvedValueOnce(response({ error: 'private upstream secret' }, 500));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText(messages.supplierIntegration.integration_request_failed);
  expect(screen.queryByText('private upstream secret')).toBe(null);
});
test('enabled validation and stale conflicts preserve edits; reload requires confirmation', async () => {
  fetchMock.mockResolvedValueOnce(response({ integration: draft, configVersion: 1 }));
  mount();
  const enabled = await screen.findByLabelText('Enabled');
  fireEvent.click(enabled);
  fetchMock.mockResolvedValueOnce(response({ error: 'invalid_request', fields: ['config'] }, 400));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText(messages.supplierIntegration.invalid_request);
  expect((enabled as HTMLInputElement).checked).toBe(true);
  fetchMock.mockResolvedValueOnce(response({ error: 'integration_conflict' }, 409));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText(messages.supplierIntegration.integration_conflict);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fetchMock.mockResolvedValueOnce(response({ integration: draft, configVersion: 2 }));
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  await waitFor(() => expect((screen.getByLabelText('Enabled') as HTMLInputElement).checked).toBe(false));
  expect(screen.getByText('Configuration version 2')).toBeTruthy();
  confirm.mockRestore();
});