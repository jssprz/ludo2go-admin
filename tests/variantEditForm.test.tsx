import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, expect, test, vi } from 'vitest';
import { VariantEditForm } from '../app/(dashboard)/variants/[id]/edit/variant-edit-form';
import type { ProductEditForm } from '../app/(dashboard)/products/[id]/edit/product-edit-form';
import messages from '../messages/en.json';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, back: mocks.back })
}));

const product: ComponentProps<typeof ProductEditForm>['product'] = {
  id: 'product-1',
  name: 'Test product',
  slug: 'test-product',
  kind: 'game',
  status: 'draft',
  tags: [],
  bggId: null,
  brandId: null,
  productionTierId: null,
  shortDescription: null,
  description: null,
  localizedDescriptions: null,
  createdByAdminUserId: null,
  updatedByAdminUserId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  game: null,
  expansion: null,
  accessory: null,
  bundle: null,
  bgg: null,
  brand: null
};

const props: ComponentProps<typeof VariantEditForm> = {
  variant: {
    id: 'variant-1',
    productId: product.id,
    product,
    sku: 'TEST-ES',
    eanUpc: null,
    edition: null,
    language: 'es',
    condition: 'new',
    status: 'draft',
    displayTitleShort: null,
    displayTitleLong: null,
    attributes: null,
    activedAt: null,
    firstActivedAt: null,
    activeAtScheduled: null,
    createdByAdminUserId: null,
    updatedByAdminUserId: null,
    weightGrams: null,
    widthMm: null,
    heightMm: null,
    depthMm: null,
    packageType: null,
    volumetricWeightGrams: null,
    prices: [],
    externalPrices: [],
    inventory: []
  },
  storeLinks: [],
  locations: [],
  pendingReceipts: []
};

function renderEditor() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <VariantEditForm {...props} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

test('Save changes persists variant edits without leaving the editor', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  renderEditor();

  await user.clear(screen.getByLabelText('SKU'));
  await user.type(screen.getByLabelText('SKU'), 'UPDATED-ES');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  await screen.findByText(messages.variantEditForm.messages.variantUpdated);
  expect(fetchMock).toHaveBeenCalledWith('/api/variants/variant-1', expect.objectContaining({
    method: 'PUT',
    body: expect.stringContaining('"sku":"UPDATED-ES"')
  }));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.back).not.toHaveBeenCalled();
});

test('Save and Exit returns to the previous page only after saving successfully', async () => {
  const user = userEvent.setup();
  let resolveSave!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
    resolveSave = resolve;
  })));
  renderEditor();

  await user.click(screen.getByRole('button', { name: 'Save and Exit' }));
  expect(mocks.back).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Saving...' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Save and Exit' }).hasAttribute('disabled')).toBe(true);

  resolveSave(Response.json({ ok: true }));
  await waitFor(() => expect(mocks.back).toHaveBeenCalledTimes(1));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

test('failed Save and Exit shows the error without leaving the variant editor', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    Response.json({ message: 'Could not save variant' }, { status: 500 })
  ));
  renderEditor();

  await user.click(screen.getByRole('button', { name: 'Save and Exit' }));

  await screen.findByText('Could not save variant');
  expect(mocks.back).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save and Exit' }).hasAttribute('disabled')).toBe(false);
});

test('submitting without an explicit button saves without exiting', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })));
  renderEditor();
  const form = screen.getByRole('button', { name: 'Save changes' }).closest('form');
  if (!form) throw new Error('Missing variant edit form');

  fireEvent.submit(form);

  await screen.findByText(messages.variantEditForm.messages.variantUpdated);
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.back).not.toHaveBeenCalled();
});
