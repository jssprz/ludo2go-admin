import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), refresh: vi.fn()
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@jssprz/ludo2go-database', () => ({
  prisma: { courier: { findMany: mocks.findMany, create: mocks.create, update: mocks.update } }
}));

import { GET, POST } from '../app/api/couriers/route';
import { PATCH } from '../app/api/couriers/[id]/route';
import { CouriersManager } from '../app/(dashboard)/couriers/couriers-manager';

const courier = { id: 'courier-1', name: 'Courier', trackingUrlTemplate: null };
const params = { params: Promise.resolve({ id: courier.id }) };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'admin-1' } });
  mocks.findMany.mockResolvedValue([courier]);
  mocks.create.mockResolvedValue(courier);
  mocks.update.mockResolvedValue(courier);
});

function request(body: unknown) {
  return new Request('http://localhost/api/couriers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
}

test('lists couriers sorted by name', async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([courier]);
  expect(mocks.findMany).toHaveBeenCalledWith({
    orderBy: { name: 'asc' }, select: { id: true, name: true, trackingUrlTemplate: true }
  });
});

test.each([null, { user: {} }])('requires a user id for all endpoints: %j', async (session) => {
  mocks.auth.mockResolvedValue(session);
  expect((await GET()).status).toBe(401);
  expect((await POST(request(courier))).status).toBe(401);
  expect((await PATCH(request(courier), params)).status).toBe(401);
  expect(mocks.findMany).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

test('create and update normalize names and blank templates', async () => {
  const payload = { name: ' Courier ', trackingUrlTemplate: '   ' };
  expect((await POST(request(payload))).status).toBe(201);
  expect(mocks.create).toHaveBeenCalledWith({ data: { name: 'Courier', trackingUrlTemplate: null } });
  expect((await PATCH(request(payload), params)).status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({
    where: { id: courier.id }, data: { name: 'Courier', trackingUrlTemplate: null }
  });
});

test('accepts tracking templates and explicit null', async () => {
  for (const trackingUrlTemplate of [null, 'https://courier.example/track/{trackingNumber}']) {
    const payload = { name: 'Courier', trackingUrlTemplate };
    expect((await POST(request(payload))).status).toBe(201);
    expect(mocks.create).toHaveBeenLastCalledWith({ data: payload });
    expect((await PATCH(request(payload), params)).status).toBe(200);
    expect(mocks.update).toHaveBeenLastCalledWith({ where: { id: courier.id }, data: payload });
  }
});

test.each([null, {}, { name: 'Courier' }, { name: '', trackingUrlTemplate: null },
  { name: 'Courier', trackingUrlTemplate: 'https://courier.example/track' },
  { name: 'Courier', trackingUrlTemplate: 'javascript:{trackingNumber}' }])('rejects invalid payloads: %j', async (payload) => {
  expect((await POST(request(payload))).status).toBe(400);
  expect((await PATCH(request(payload), params)).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

test('rejects malformed JSON without writing', async () => {
  const malformed = () => new Request('http://localhost/api/couriers', { method: 'POST', body: '{' });
  expect((await POST(malformed())).status).toBe(400);
  expect((await PATCH(malformed(), params)).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

test('duplicate names return 409 on create and update', async () => {
  mocks.create.mockRejectedValue({ code: 'P2002' });
  mocks.update.mockRejectedValue({ code: 'P2002' });
  expect((await POST(request(courier))).status).toBe(409);
  expect((await PATCH(request(courier), params)).status).toBe(409);
});

test('updating a missing courier returns 404', async () => {
  mocks.update.mockRejectedValue({ code: 'P2025' });
  expect((await PATCH(request(courier), params)).status).toBe(404);
});

test('unexpected failures return safe generic errors', async () => {
  const failure = new Error('sensitive database details');
  mocks.findMany.mockRejectedValue(failure);
  mocks.create.mockRejectedValue(failure);
  mocks.update.mockRejectedValue(failure);
  for (const response of [await GET(), await POST(request(courier)), await PATCH(request(courier), params)]) {
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('sensitive');
  }
});

test('UI creates a courier and refreshes', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(Response.json(courier, { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<CouriersManager couriers={[]} />);
  expect(screen.getByText('No couriers found.')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Add courier' }));
  await user.type(screen.getByRole('textbox', { name: 'Name' }), ' Courier ');
  await user.click(screen.getByRole('button', { name: 'Create courier' }));
  expect(fetchMock).toHaveBeenCalledWith('/api/couriers', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ name: 'Courier', trackingUrlTemplate: null })
  }));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('UI edits an existing courier and clears its template', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(Response.json(courier));
  vi.stubGlobal('fetch', fetchMock);
  render(<CouriersManager couriers={[{ ...courier, trackingUrlTemplate: 'https://courier.example/{trackingNumber}' }]} />);
  await user.click(screen.getByRole('button', { name: 'Edit Courier' }));
  expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Courier');
  await user.clear(screen.getByRole('textbox', { name: 'Tracking URL template' }));
  await user.click(screen.getByRole('button', { name: 'Save courier' }));
  expect(fetchMock).toHaveBeenCalledWith('/api/couriers/courier-1', expect.objectContaining({
    method: 'PATCH', body: JSON.stringify({ name: 'Courier', trackingUrlTemplate: null })
  }));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

test('UI validates templates before sending', async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  render(<CouriersManager couriers={[courier]} />);
  await user.click(screen.getByRole('button', { name: 'Edit Courier' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Tracking URL template' }), { target: { value: 'https://courier.example' } });
  await user.click(screen.getByRole('button', { name: 'Save courier' }));
  expect(screen.getByRole('alert').textContent).toContain('{trackingNumber}');
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(['duplicate', 'network'])('UI keeps the dialog and input on %s errors', async (failure) => {
  const user = userEvent.setup();
  const fetchMock = failure === 'duplicate'
    ? vi.fn().mockResolvedValue(Response.json({ error: 'Duplicate' }, { status: 409 }))
    : vi.fn().mockRejectedValue(new Error('Network failure'));
  vi.stubGlobal('fetch', fetchMock);
  render(<CouriersManager couriers={[courier]} />);
  await user.click(screen.getByRole('button', { name: 'Edit Courier' }));
  await user.click(screen.getByRole('button', { name: 'Save courier' }));
  expect(screen.getByRole('alert').textContent).toContain(failure === 'duplicate' ? 'already exists' : 'try again');
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).toBe('Courier');
  expect(mocks.refresh).not.toHaveBeenCalled();
});

test('UI disables submission while saving', async () => {
  const user = userEvent.setup();
  let resolveSave!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((resolve) => { resolveSave = resolve; })));
  render(<CouriersManager couriers={[courier]} />);
  await user.click(screen.getByRole('button', { name: 'Edit Courier' }));
  await user.click(screen.getByRole('button', { name: 'Save courier' }));
  expect((screen.getByRole('button', { name: 'Saving...' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).disabled).toBe(true);
  await act(async () => { resolveSave(Response.json(courier)); });
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

test('UI retries loading failures', async () => {
  const user = userEvent.setup();
  render(<CouriersManager couriers={[]} loadError="Failed to load couriers." />);
  expect(screen.getByRole('alert').textContent).toBe('Failed to load couriers.');
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});