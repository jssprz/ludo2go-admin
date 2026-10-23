import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { SupplierIntegrationDialog } from '../app/(dashboard)/suppliers/supplier-integration-dialog';
import messages from '../messages/en.json';

const fetchMock = vi.fn();
const close = vi.fn();
const draft = {
  updatedAt: '2026-10-18T00:00:00.000Z',
  adapterKey: 'devir',
  baseUrl: '',
  authMethod: 'form',
  usernameSecretRef: null,
  passwordSecretRef: null,
  sessionSecretRef: null,
  browserSecretRef: null,
  browserRendering: false,
  taxTreatment: 'unconfirmed',
  taxVerifiedAt: null,
  integrationVerifiedAt: null,
  isEnabled: false,
  config: {}
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
function mount() {
  return render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <SupplierIntegrationDialog
        supplier={{ id: 'fixture', name: 'Fixture supplier' }}
        onClose={close}
      />
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(
    response({ integration: null, configVersion: null })
  );
});
test('opens with observed Devir defaults and saves a disabled draft with secret reference names', async () => {
  mount();
  const reference = await screen.findByLabelText(
    'Username environment reference'
  );
  expect(reference.getAttribute('type')).not.toBe('password');
  expect((reference as HTMLInputElement).value).toBe('SUPPLIER_DEVIR_USERNAME');
  const initialConfig = JSON.parse(
    (
      screen.getByLabelText(
        'Verification and catalog JSON'
      ) as HTMLTextAreaElement
    ).value
  );
  expect(initialConfig.catalog.paths).toEqual(['/categoria-producto/devir/']);
  fireEvent.change(reference, {
    target: { value: 'SUPPLIER_DEVIR_USERNAME_TEST' }
  });
  fetchMock.mockResolvedValueOnce(
    response({
      integration: {
        ...draft,
        baseUrl: 'https://btb.devir.cl',
        usernameSecretRef: 'SUPPLIER_DEVIR_USERNAME_TEST',
        config: initialConfig
      },
      configVersion: 1
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('Integration saved.');
  const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(payload).toMatchObject({
    isEnabled: false,
    usernameSecretRef: 'SUPPLIER_DEVIR_USERNAME_TEST',
    updatedAt: null,
    integrationVerifiedAt: null
  });
  expect(payload.config.verification.priceSelector).toBe(
    '.summary .price ins .woocommerce-Price-amount bdi'
  );
  expect(
    (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled
  ).toBe(true);
});
test('JSON errors stay local and raw API details are not rendered', async () => {
  mount();
  const config = await screen.findByLabelText('Verification and catalog JSON');
  fireEvent.change(config, { target: { value: '{' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText('Enter valid JSON before saving.');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.change(config, { target: { value: '{}' } });
  fireEvent.change(screen.getByLabelText('Base URL'), {
    target: { value: 'https://btb.devir.cl' }
  });
  fetchMock.mockResolvedValueOnce(
    response({ error: 'private upstream secret' }, 500)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText(
    messages.supplierIntegration.integration_request_failed
  );
  expect(screen.queryByText('private upstream secret')).toBe(null);
});
test('existing empty configurations can reload observed defaults without losing custom secret references', async () => {
  fetchMock.mockResolvedValueOnce(
    response({
      integration: {
        ...draft,
        baseUrl: 'https://btb.devir.cl',
        usernameSecretRef: 'SUPPLIER_COMPANY_DEVIR_USER',
        config: {}
      },
      configVersion: 4
    })
  );
  mount();
  await screen.findByLabelText('Verification and catalog JSON');
  fireEvent.click(screen.getByText('Advanced configuration'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Load observed defaults' })
  );
  const config = JSON.parse(
    (
      screen.getByLabelText(
        'Verification and catalog JSON'
      ) as HTMLTextAreaElement
    ).value
  );
  expect(config.catalog.paths).toEqual(['/categoria-producto/devir/']);
  expect(
    (
      screen.getByLabelText(
        'Username environment reference'
      ) as HTMLInputElement
    ).value
  ).toBe('SUPPLIER_COMPANY_DEVIR_USER');
  expect((screen.getByLabelText('Enabled') as HTMLInputElement).checked).toBe(
    false
  );
});
test('enabled validation and stale conflicts preserve edits; reload requires confirmation', async () => {
  fetchMock.mockResolvedValueOnce(
    response({ integration: draft, configVersion: 1 })
  );
  mount();
  const enabled = await screen.findByLabelText('Enabled');
  fireEvent.click(enabled);
  fetchMock.mockResolvedValueOnce(
    response({ error: 'invalid_request', fields: ['config'] }, 400)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText(messages.supplierIntegration.invalid_request);
  expect((enabled as HTMLInputElement).checked).toBe(true);
  fetchMock.mockResolvedValueOnce(
    response({ error: 'integration_conflict' }, 409)
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await screen.findByText(messages.supplierIntegration.integration_conflict);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  fetchMock.mockResolvedValueOnce(
    response({ integration: draft, configVersion: 2 })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
  await waitFor(() =>
    expect((screen.getByLabelText('Enabled') as HTMLInputElement).checked).toBe(
      false
    )
  );
  expect(screen.getByText('Configuration version 2')).toBeTruthy();
  confirm.mockRestore();
});
