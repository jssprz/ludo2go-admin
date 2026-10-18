import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';
import { GuideStatus } from '@prisma/client';
import { GuidesTable } from '../app/(dashboard)/guides/guides-table';
import { toDateTimeLocalInput } from '../lib/date-time-local';
import messages from '../messages/en.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const entries = (messages as unknown as Record<string, Record<string, string>>)[namespace];
    return entries?.[key] ?? `${namespace}.${key}`;
  }
}));

type Guide = ComponentProps<typeof GuidesTable>['initialGuides'][number];
const fetchMock = vi.fn();

function makeGuide(overrides: Partial<Guide> = {}): Guide {
  return {
    id: 'guide-1', slug: 'buying-guide', title: 'Buying guide', subtitle: null,
    excerpt: null, status: GuideStatus.draft, coverImageUrl: null, publishedAt: null,
    scheduledAt: null, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    categoryId: null, category: null, visits: 42, _count: { blocks: 2, variants: 3 },
    ...overrides
  };
}

function renderTable(guide = makeGuide()) {
  render(<GuidesTable initialGuides={[guide]} categories={[]} />);
  return guide;
}

async function selectStatus(status: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Status: Buying guide' }));
  await user.click(screen.getByRole('option', { name: status }));
}

function mockSuccessfulSave(guide: Guide) {
  fetchMock.mockImplementation(async (_url: string, options: RequestInit) => ({
    ok: true,
    json: async () => {
      const { visits, ...response } = guide;
      return { ...response, ...JSON.parse(options.body as string) };
    }
  }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

test.each([
  ['Published', GuideStatus.published],
  ['Draft', GuideStatus.draft],
  ['Archived', GuideStatus.archived]
])('changes a scheduled guide to %s and clears its schedule', async (label, status) => {
  const guide = renderTable(makeGuide({ status: GuideStatus.scheduled, scheduledAt: new Date('2099-05-01T12:00:00Z') }));
  mockSuccessfulSave(guide);
  await selectStatus(label);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull());
  expect(fetchMock).toHaveBeenCalledWith('/api/guides/guide-1', expect.objectContaining({
    method: 'PUT',
    body: JSON.stringify({ title: guide.title, slug: guide.slug, status, scheduledAt: null })
  }));
  expect(screen.getByText('42')).toBeTruthy();
  expect(screen.queryByLabelText(messages.guides.scheduledAt)).toBeNull();
});

test('requires a future date when scheduling a guide, then saves browser-local time as ISO', async () => {
  const guide = renderTable();
  mockSuccessfulSave(guide);
  await selectStatus('Scheduled');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert').textContent).toBe(messages.guides.scheduleInvalid);
  expect(fetchMock).not.toHaveBeenCalled();
  const input = screen.getByLabelText(messages.guides.scheduledAt);
  fireEvent.change(input, { target: { value: '2020-01-01T12:00' } });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '2099-05-02T12:30' } });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    title: guide.title, slug: guide.slug, status: GuideStatus.scheduled,
    scheduledAt: new Date('2099-05-02T12:30').toISOString()
  });
});

test('reschedules an already scheduled guide directly from the table', async () => {
  const guide = renderTable(makeGuide({ status: GuideStatus.scheduled, scheduledAt: new Date('2099-05-01T12:00:00Z') }));
  mockSuccessfulSave(guide);
  expect((screen.getByLabelText(messages.guides.scheduledAt) as HTMLInputElement).value).toBe(toDateTimeLocalInput(guide.scheduledAt));
  fireEvent.change(screen.getByLabelText(messages.guides.scheduledAt), { target: { value: '2099-06-03T15:00' } });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).scheduledAt).toBe(new Date('2099-06-03T15:00').toISOString());
});

test('cancel restores the saved status and schedule without making a request', async () => {
  const guide = renderTable(makeGuide({ status: GuideStatus.scheduled, scheduledAt: new Date('2099-05-01T12:00:00Z') }));
  fireEvent.change(screen.getByLabelText(messages.guides.scheduledAt), { target: { value: '2099-06-03T15:00' } });
  await selectStatus('Draft');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect((screen.getByLabelText(messages.guides.scheduledAt) as HTMLInputElement).value).toBe(toDateTimeLocalInput(guide.scheduledAt));
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('disables controls while saving and allows retry after an API error', async () => {
  const guide = renderTable();
  let finish!: (response: unknown) => void;
  fetchMock.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await selectStatus('Published');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect((screen.getByRole('combobox', { name: 'Status: Buying guide' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
  finish({ ok: false, json: async () => ({ error: 'Publishing failed' }) });
  expect((await screen.findByRole('alert')).textContent).toBe('Publishing failed');
  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  mockSuccessfulSave(guide);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull());
  expect(screen.queryByRole('alert')).toBeNull();
});