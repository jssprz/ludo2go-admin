import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { ProductEditForm } from '../app/(dashboard)/products/[id]/edit/product-edit-form';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push })
}));
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: () => <div aria-label="Description editor" />
}));

const props: ComponentProps<typeof ProductEditForm> = {
  product: {
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
  },
  timelines: [],
  brands: [],
  gameCategories: [],
  accessoryCategories: [],
  gameThemes: [],
  gameMechanics: [],
  gameComplexities: [],
  baseGames: []
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('Save changes persists edits and refreshes without navigating away', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ProductEditForm {...props} />);

  await user.clear(screen.getByLabelText('Name*'));
  await user.type(screen.getByLabelText('Name*'), 'Updated product');
  await user.click(screen.getByRole('button', { name: 'Save changes' }));

  await screen.findByText('Product updated successfully.');
  expect(fetchMock).toHaveBeenCalledWith('/api/products/product-1', expect.objectContaining({
    method: 'PUT',
    body: expect.stringContaining('"name":"Updated product"')
  }));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.push).not.toHaveBeenCalled();
});

test('Save and Exit returns to the catalog only after the save succeeds', async () => {
  const user = userEvent.setup();
  let resolveSave!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
    resolveSave = resolve;
  })));
  render(<ProductEditForm {...props} />);

  await user.click(screen.getByRole('button', { name: 'Save and Exit' }));
  expect(mocks.push).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Saving...' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Save and Exit' }).hasAttribute('disabled')).toBe(true);

  resolveSave(Response.json({ ok: true }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/products'));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

test('a failed Save and Exit displays the error and stays in the editor', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    Response.json({ message: 'Could not save product' }, { status: 500 })
  ));
  render(<ProductEditForm {...props} />);

  await user.click(screen.getByRole('button', { name: 'Save and Exit' }));

  await screen.findByText('Could not save product');
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save and Exit' }).hasAttribute('disabled')).toBe(false);
});

test('a submission without an explicit button saves without exiting', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })));
  render(<ProductEditForm {...props} />);
  const form = screen.getByRole('button', { name: 'Save changes' }).closest('form');
  if (!form) throw new Error('Missing product edit form');

  fireEvent.submit(form);

  await screen.findByText('Product updated successfully.');
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.push).not.toHaveBeenCalled();
});
