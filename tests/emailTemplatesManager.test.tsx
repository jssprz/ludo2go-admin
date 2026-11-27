import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../messages/en.json';
import { EmailTemplatesManager } from '../app/(dashboard)/email-templates/email-templates-manager';
import { newEmailTemplate } from '../lib/email-templates';

const record = {
  ...newEmailTemplate,
  name: 'Welcome',
  id: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-11-27T04:00:00.000Z',
  updatedAt: '2026-11-27T04:00:00.000Z'
};
const fetchMock = vi.fn();
function show() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <EmailTemplatesManager />
    </NextIntlClientProvider>
  );
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

test('creates a template and previews unsaved content with editable JSON in a sandbox', async () => {
  fetchMock.mockResolvedValueOnce(json({ templates: [] }));
  show();
  await screen.findByText(messages.emailTemplates.empty);
  fireEvent.click(screen.getByText('New template'));
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Welcome' }
  });
  fireEvent.change(screen.getByLabelText('Subject template'), {
    target: { value: 'Hello {{customerName}}' }
  });
  fireEvent.change(screen.getByLabelText('Preview sample JSON'), {
    target: { value: '{"customerName":"Example"}' }
  });
  fetchMock.mockResolvedValueOnce(
    json({ subject: 'Hello Example', html: '<p>Example</p>', text: null })
  );
  fireEvent.click(screen.getByText('Preview'));
  await screen.findByText('Hello Example');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
    template: { subjectTemplate: 'Hello {{customerName}}' },
    sample: { customerName: 'Example' }
  });
  const frame = screen.getByTitle('HTML email preview');
  expect(frame.getAttribute('sandbox')).toBe('');
  expect(frame.getAttribute('srcdoc')).toBe('<p>Example</p>');
  fetchMock.mockResolvedValueOnce(
    json({ ...record, subjectTemplate: 'Hello {{customerName}}' })
  );
  fireEvent.click(screen.getByText('Save'));
  await screen.findByText('Template saved.');
  expect(fetchMock.mock.calls[2][1].method).toBe('POST');
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).not.toHaveProperty(
    'sample'
  );
});

test('keeps edits on a revision conflict and invalidates stale previews', async () => {
  fetchMock.mockResolvedValueOnce(json({ templates: [record] }));
  show();
  fireEvent.click(await screen.findByText('Edit'));
  fetchMock.mockResolvedValueOnce(
    json({ subject: 'Rendered', html: '<p>Rendered</p>', text: null })
  );
  fireEvent.click(screen.getByText('Preview'));
  await screen.findByText('Rendered');
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Edited' }
  });
  expect(screen.queryByTitle('HTML email preview')).toBeNull();
  fetchMock.mockResolvedValueOnce(json({ error: 'conflict' }, 409));
  fireEvent.click(screen.getByText('Save'));
  await screen.findByRole('alert');
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
    'Edited'
  );
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).updatedAt).toBe(
    record.updatedAt
  );
});

test('reports malformed JSON without calling the preview API and confirms deletion', async () => {
  fetchMock.mockResolvedValueOnce(json({ templates: [record] }));
  show();
  fireEvent.click(await screen.findByText('Edit'));
  fireEvent.change(screen.getByLabelText('Preview sample JSON'), {
    target: { value: '{' }
  });
  fireEvent.click(screen.getByText('Preview'));
  await screen.findByText('Enter valid JSON.');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockResolvedValueOnce(json({ success: true }));
  fireEvent.click(screen.getByText('Delete'));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(window.confirm).toHaveBeenCalled();
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
  await screen.findByText('Template deleted.');
});
