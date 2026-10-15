import { useEffect, useState, type ComponentProps, type ReactElement } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { GuideBlocksManager } from '../app/(dashboard)/guides/[id]/guide-blocks-manager';
import { GuideVariantsManager } from '../app/(dashboard)/guides/[id]/guide-variants-manager';
import GuideDetailPage from '../app/(dashboard)/guides/[id]/page';
import messages from '../messages/en.json';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(), push: vi.fn(), findGuide: vi.fn(), findCategories: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
  notFound: () => { throw new Error('Unexpected missing guide'); }
}));
vi.mock('@jssprz/ludo2go-database', () => ({
  prisma: {
    guide: { findUnique: mocks.findGuide },
    guideCategory: { findMany: mocks.findCategories }
  }
}));
vi.mock('next-intl', () => ({ useTranslations: translate }));
vi.mock('next-intl/server', () => ({ getTranslations: async (namespace: string) => translate(namespace) }));
vi.mock('../app/(dashboard)/guides/[id]/guide-editor', () => ({
  GuideEditor: () => <div aria-label="Metadata editor stub" />
}));

function translate(namespace: string) {
  const entries = (messages as unknown as Record<string, Record<string, string>>)[namespace];
  const translator = (key: string) => {
    if (!entries?.[key]) throw new Error(`Missing translation: ${namespace}.${key}`);
    return entries[key];
  };
  translator.has = (key: string) => Boolean(entries?.[key]);
  return translator;
}

type Guide = ComponentProps<typeof GuideBlocksManager>['guide'] &
  ComponentProps<typeof GuideVariantsManager>['guide'];
const guideId = '00000000-0000-4000-8000-000000000001';
const blockId = '00000000-0000-4000-8000-000000000002';
const catalogVariant = {
  id: 'variant-catan', sku: 'CATAN-ES', availableQuantity: 5, isAvailable: true,
  product: { id: 'product-catan', name: 'Catan', slug: 'catan' }
};
const association = { guideId, variantId: catalogVariant.id, variant: catalogVariant };

function makeGuide(): Guide {
  return {
    id: guideId,
    title: 'Buying guide',
    variants: [],
    blocks: [{
      id: blockId,
      guideId,
      type: 'rich_text',
      sortOrder: 0,
      title: null,
      body: '<p>Original advice</p>',
      imageUrl: null,
      imageAlt: null,
      buttonText: null,
      buttonUrl: null,
      data: {}
    }]
  };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.refresh.mockReset();
  mocks.push.mockReset();
  mocks.findGuide.mockReset();
  mocks.findCategories.mockReset().mockResolvedValue([]);
});

async function renderDetail(snapshot: { guide: Guide }) {
  mocks.findGuide.mockImplementation(async () => structuredClone({
    ...snapshot.guide,
    category: null,
    _count: { blocks: snapshot.guide.blocks.length, variants: snapshot.guide.variants.length }
  }));
  const loadPage = () => GuideDetailPage({ params: Promise.resolve({ id: guideId }) });
  const initial = await loadPage();
  function RefreshingParent({ initialPage }: { initialPage: ReactElement }) {
    const [page, setPage] = useState(initialPage);
    useEffect(() => {
      mocks.refresh.mockImplementation(() => { void loadPage().then(setPage); });
      return () => { mocks.refresh.mockReset(); };
    }, []);
    return page;
  }
  render(<RefreshingParent initialPage={initial} />);
}

async function openBlock(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Edit block' }));
  return screen.getByRole('dialog', { name: 'Edit block' });
}

async function chooseType(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('combobox', { name: 'Block type' }));
  await user.click(await screen.findByRole('option', { name: label }));
}

test('one Save block click immediately sends one PUT and commits the response', async () => {
  const user = userEvent.setup();
  const guide = makeGuide();
  const response = deferred<Response>();
  const fetchMock = vi.fn().mockReturnValue(response.promise);
  vi.stubGlobal('fetch', fetchMock);
  render(<GuideBlocksManager guide={guide} />);
  await user.click(screen.getByRole('button', { name: 'Edit block' }));
  const dialog = screen.getByRole('dialog', { name: 'Edit block' });
  await user.click(within(dialog).getByRole('button', { name: 'Save block' }));

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toBe(`/api/guide-blocks/${blockId}`);
  expect(request.method).toBe('PUT');
  expect(JSON.parse(request.body)).toMatchObject({
    guideId, type: 'rich_text', body: '<p>Original advice</p>', data: {}
  });
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect((within(dialog).getByRole('button', { name: 'Save block' }) as HTMLButtonElement).disabled).toBe(true);

  await act(async () => {
    response.resolve(Response.json({ ...guide.blocks[0], body: '<p>Server-normalized advice</p>' }));
  });
  expect(within(dialog).getByText('Block saved.')).toBeTruthy();
  expect(within(dialog).getByRole('group', { name: 'Content' }).textContent).toContain('Server-normalized advice');
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('a rapid double click cannot send a second block save while the first PUT is pending', async () => {
  const user = userEvent.setup();
  const guide = makeGuide();
  const response = deferred<Response>();
  const fetchMock = vi.fn().mockReturnValue(response.promise);
  vi.stubGlobal('fetch', fetchMock);
  render(<GuideBlocksManager guide={guide} />);
  const dialog = await openBlock(user);
  const save = within(dialog).getByRole('button', { name: 'Save block' });
  await user.dblClick(save);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(mocks.refresh).not.toHaveBeenCalled();
  act(() => {
    fireEvent.submit(save.closest('form')!);
    fireEvent.submit(save.closest('form')!);
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => { response.resolve(Response.json(guide.blocks[0])); });
  expect(within(dialog).getByText('Block saved.')).toBeTruthy();
  expect((save as HTMLButtonElement).disabled).toBe(false);
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('Rich text converts to Product recommendation with a selected slug, one structured PUT, and refreshed associations', async () => {
  const user = userEvent.setup();
  const inherited = {
    guideId, variantId: 'variant-azul',
    variant: { id: 'variant-azul', sku: 'AZUL-ES', product: { id: 'product-azul', name: 'Azul', slug: 'azul' } }
  };
  const snapshot = { guide: { ...makeGuide(), variants: [inherited] } };
  const response = deferred<Response>();
  const fetchMock = vi.fn((url: string, request?: RequestInit) => {
    if (url.startsWith('/api/variants/search?')) return Promise.resolve(Response.json([catalogVariant]));
    if (url === `/api/guide-blocks/${blockId}` && request?.method === 'PUT') return response.promise;
    throw new Error(`Unexpected request: ${request?.method ?? 'GET'} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  await renderDetail(snapshot);
  await user.click(screen.getByRole('tab', { name: 'Content Blocks (1)' }));
  const dialog = await openBlock(user);
  await chooseType(user, 'Product recommendation');
  await user.type(within(dialog).getByRole('textbox', { name: 'Product *' }), 'catan');
  await user.click(await within(dialog).findByRole('button', { name: /Catan.*CATAN-ES/ }));
  expect(within(dialog).getByText('catan')).toBeTruthy();
  await user.click(within(dialog).getByRole('button', { name: 'Save block' }));
  const writes = fetchMock.mock.calls.filter(([, request]) => request?.method === 'PUT');
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toBe(`/api/guide-blocks/${blockId}`);
  expect(writes[0][1]?.headers).toEqual({ 'Content-Type': 'application/json' });
  const payload = JSON.parse(writes[0][1]!.body as string);
  expect(payload).toMatchObject({
    guideId, type: 'product_recommendation', body: '<p>Original advice</p>',
    data: { productSlug: 'catan', summary: '<p>Original advice</p>', bestFor: [] }
  });
  expect(typeof payload.data).toBe('object');
  expect(payload.data.productSlug).not.toBe(catalogVariant.id);
  expect(mocks.refresh).not.toHaveBeenCalled();
  snapshot.guide.blocks = [{ ...snapshot.guide.blocks[0], ...payload, data: { ...payload.data, title: 'Server recommendation' } }];
  snapshot.guide.variants = [inherited, association];
  await act(async () => { response.resolve(Response.json(snapshot.guide.blocks[0])); });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Product Variants (2)', hidden: true })).toBeTruthy());
  expect(within(dialog).getByRole('textbox', { name: 'Title' })).toHaveProperty('value', 'Server recommendation');
  expect(within(dialog).getByText('Block saved.')).toBeTruthy();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.findGuide).toHaveBeenCalledTimes(2);
  expect(mocks.findGuide.mock.calls[1][0]).toMatchObject({
    where: { id: guideId }, include: { _count: { select: { blocks: true, variants: true } } }
  });
  await user.click(within(dialog).getByText('Close', { selector: 'button' }));
  expect(screen.getByRole('heading', { name: 'Product recommendation' })).toBeTruthy();
  expect(screen.getByText(/Inherited product associations.*azul/)).toBeTruthy();
  await user.click(screen.getByRole('tab', { name: 'Product Variants (2)' }));
  expect(screen.getByText('Azul')).toBeTruthy();
  expect(screen.getByText('Catan')).toBeTruthy();
  expect(fetchMock.mock.calls.filter(([, request]) => request?.method === 'PUT')).toHaveLength(1);
});

test('invalid advanced JSON displays an inline error and prevents saving even on form submission', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn(() => { throw new Error('Invalid JSON must not reach fetch'); });
  vi.stubGlobal('fetch', fetchMock);
  render(<GuideBlocksManager guide={makeGuide()} />);
  const dialog = await openBlock(user);
  await user.click(within(dialog).getByRole('checkbox', { name: 'Advanced JSON' }));
  const data = within(dialog).getByRole('textbox', { name: 'Structured data' });
  await user.clear(data);
  await user.paste('{broken');
  expect(data.getAttribute('aria-invalid')).toBe('true');
  expect(within(dialog).getByRole('alert').textContent).toBe('Invalid JSON. Correct it before saving.');
  const save = within(dialog).getByRole('button', { name: 'Save block' });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  await user.click(save);
  fireEvent.submit(save.closest('form')!);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
  await user.clear(data);
  await user.paste('{}');
  expect(within(dialog).queryByRole('alert')).toBeNull();
  expect((save as HTMLButtonElement).disabled).toBe(false);
});

test('creating a block refreshes the real GuideDetail tab count and manager props', async () => {
  const user = userEvent.setup();
  const snapshot = { guide: { ...makeGuide(), blocks: [] as Guide['blocks'] } };
  const response = deferred<Response>();
  const fetchMock = vi.fn().mockReturnValue(response.promise);
  vi.stubGlobal('fetch', fetchMock);
  await renderDetail(snapshot);
  await user.click(screen.getByRole('tab', { name: 'Content Blocks (0)' }));
  await user.click(screen.getByRole('button', { name: 'Add block' }));
  await chooseType(user, 'Heading');
  const dialog = screen.getByRole('dialog', { name: 'Create block' });
  await user.type(within(dialog).getByRole('textbox', { name: 'Heading *' }), 'New advice');
  await user.click(within(dialog).getByRole('button', { name: 'Save block' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/guide-blocks');
  expect(request.method).toBe('POST');
  expect(JSON.parse(request.body)).toMatchObject({ guideId, type: 'heading', title: 'New advice' });
  expect(screen.getByRole('tab', { name: 'Content Blocks (0)', hidden: true })).toBeTruthy();
  const returned = { ...makeGuide().blocks[0], type: 'heading' as const, title: 'Server heading', body: null };
  snapshot.guide.blocks = [returned];
  await act(async () => { response.resolve(Response.json(returned)); });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Content Blocks (1)', hidden: true })).toBeTruthy());
  expect(within(dialog).getByRole('textbox', { name: 'Heading *' })).toHaveProperty('value', 'Server heading');
  await user.click(within(dialog).getByText('Close', { selector: 'button' }));
  expect(screen.getByRole('heading', { name: 'Blocks (1)' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Server heading' })).toBeTruthy();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.findGuide).toHaveBeenCalledTimes(2);
});

test('adding a variant sends one POST, updates the real manager, and refreshes GuideDetail counts', async () => {
  const user = userEvent.setup();
  const snapshot = { guide: makeGuide() };
  const response = deferred<Response>();
  const fetchMock = vi.fn((url: string, request?: RequestInit) => {
    if (url.startsWith('/api/variants/search?')) return Promise.resolve(Response.json([catalogVariant]));
    if (url === `/api/guide-product-variants/${guideId}` && request?.method === 'POST') return response.promise;
    throw new Error(`Unexpected request: ${request?.method ?? 'GET'} ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  await renderDetail(snapshot);
  await user.click(screen.getByRole('tab', { name: 'Product Variants (0)' }));
  await user.click(screen.getByRole('button', { name: 'Link Product Variant' }));
  const dialog = screen.getByRole('dialog', { name: 'Link Product Variant' });
  await user.type(within(dialog).getByRole('textbox', { name: 'Search Product Variants' }), 'catan');
  await user.click(await within(dialog).findByRole('radio', { name: /Catan.*CATAN-ES/ }));
  await user.dblClick(within(dialog).getByRole('button', { name: 'Add' }));
  const writes = fetchMock.mock.calls.filter(([, request]) => request?.method === 'POST');
  expect(writes).toHaveLength(1);
  expect(writes[0][0]).toBe(`/api/guide-product-variants/${guideId}`);
  expect(JSON.parse(writes[0][1]!.body as string)).toEqual({ variantId: catalogVariant.id });
  expect(mocks.refresh).not.toHaveBeenCalled();
  snapshot.guide.variants = [association];
  await act(async () => { response.resolve(Response.json(association)); });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Product Variants (1)' })).toBeTruthy());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('Catan')).toBeTruthy();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.findGuide).toHaveBeenCalledTimes(2);

  snapshot.guide.variants = [{ ...association, variant: { ...catalogVariant, product: { ...catalogVariant.product, name: 'Refreshed Catan' } } }];
  act(() => { mocks.refresh(); });
  await screen.findByText('Refreshed Catan');
  expect(screen.queryByText('Catan')).toBeNull();
  expect(screen.getByRole('tab', { name: 'Product Variants (1)' })).toBeTruthy();
  expect(fetchMock.mock.calls.filter(([, request]) => request?.method === 'POST')).toHaveLength(1);
});

test('removing a variant sends one DELETE and refreshes GuideDetail and manager counts to zero', async () => {
  const user = userEvent.setup();
  const snapshot = { guide: { ...makeGuide(), variants: [association] } };
  const response = deferred<Response>();
  const fetchMock = vi.fn().mockReturnValue(response.promise);
  vi.stubGlobal('fetch', fetchMock);
  await renderDetail(snapshot);
  await user.click(screen.getByRole('tab', { name: 'Product Variants (1)' }));
  await user.click(screen.getByRole('button', { name: 'Actions: Catan' }));
  await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
  const dialog = screen.getByRole('dialog', { name: 'Remove Product Variant' });
  await user.dblClick(within(dialog).getByRole('button', { name: 'Remove' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/guide-product-variants/${guideId}?variantId=${catalogVariant.id}`, { method: 'DELETE' }
  );
  expect(mocks.refresh).not.toHaveBeenCalled();
  snapshot.guide.variants = [];
  await act(async () => { response.resolve(Response.json({ success: true })); });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Product Variants (0)' })).toBeTruthy());
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByText('Catan')).toBeNull();
  expect(screen.getByText(messages.guides.noVariants)).toBeTruthy();
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(mocks.findGuide).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});