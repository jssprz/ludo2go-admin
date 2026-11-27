import { beforeEach, expect, test, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { GET, POST } from '../app/api/email-templates/route';
import { PUT, DELETE } from '../app/api/email-templates/[id]/route';
import { POST as preview } from '../app/api/email-templates/preview/route';
import { newEmailTemplate } from '../lib/email-templates';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  findUniqueOrThrow: vi.fn()
}));
vi.mock('../lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@jssprz/ludo2go-database', () => ({
  prisma: {
    emailTemplate: mocks,
    $transaction: (fn: (tx: unknown) => unknown) => fn({ emailTemplate: mocks })
  }
}));

const id = '11111111-1111-4111-8111-111111111111';
const updatedAt = '2026-11-27T04:00:00.000Z';
const input = { ...newEmailTemplate, name: 'Welcome' };
const context = { params: Promise.resolve({ id }) };
function request(
  method: string,
  body?: unknown,
  origin = 'https://admin.example.com'
) {
  return new Request(`https://admin.example.com/api/email-templates/${id}`, {
    method,
    headers: { 'Content-Type': 'application/json', origin },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'admin' } });
});

test('protects reads, writes, deletion and previews with authentication', async () => {
  mocks.auth.mockResolvedValue(null);
  const responses = await Promise.all([
    GET(request('GET')),
    POST(request('POST', input)),
    PUT(request('PUT', { ...input, updatedAt }), context),
    DELETE(request('DELETE', { updatedAt }), context),
    preview(request('POST', { template: input, sample: {} }))
  ]);
  expect(responses.map((response) => response.status)).toEqual([
    401, 401, 401, 401, 401
  ]);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.updateMany).not.toHaveBeenCalled();
  expect(mocks.deleteMany).not.toHaveBeenCalled();
});

test('rejects cross-origin writes and internal report types', async () => {
  expect(
    (await POST(request('POST', input, 'https://other.example.com'))).status
  ).toBe(403);
  expect(
    (await POST(request('POST', { ...input, key: 'cart_abandonment_report' })))
      .status
  ).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});

test('lists only customer types and saves templates without sending emails', async () => {
  mocks.findMany.mockResolvedValue([]);
  expect(await (await GET(request('GET'))).json()).toEqual({ templates: [] });
  expect(mocks.findMany.mock.calls[0][0].where.key.in).not.toContain(
    'weekly_analytics_report'
  );
  mocks.create.mockResolvedValue({ ...input, id, updatedAt });
  expect((await POST(request('POST', input))).status).toBe(201);
  expect(mocks.create).toHaveBeenCalledWith({ data: input });
});

test('returns a duplicate conflict from the database unique constraint', async () => {
  mocks.create.mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test'
    })
  );
  const response = await POST(request('POST', input));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'duplicate' });
});

test('updates and deletes only matching revisions within customer scope', async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  expect(
    (await PUT(request('PUT', { ...input, updatedAt }), context)).status
  ).toBe(409);
  expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled();
  expect(mocks.updateMany.mock.calls[0][0].where).toMatchObject({
    id,
    updatedAt: new Date(updatedAt)
  });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.findUniqueOrThrow.mockResolvedValue({ ...input, id, updatedAt });
  expect(
    (await PUT(request('PUT', { ...input, updatedAt }), context)).status
  ).toBe(200);
  mocks.deleteMany.mockResolvedValue({ count: 0 });
  expect((await DELETE(request('DELETE', { updatedAt }), context)).status).toBe(
    409
  );
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  expect((await DELETE(request('DELETE', { updatedAt }), context)).status).toBe(
    200
  );
  expect(mocks.deleteMany.mock.calls[0][0].where.key.in).not.toContain(
    'weekly_analytics_report'
  );
});

test('advances the revision even when two saves share the same millisecond', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(updatedAt));
  try {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({ ...input, id, updatedAt });
    await PUT(request('PUT', { ...input, updatedAt }), context);
    expect(mocks.updateMany.mock.calls[0][0].data.updatedAt).toEqual(
      new Date(new Date(updatedAt).getTime() + 1)
    );
  } finally {
    vi.useRealTimers();
  }
});

test('previews without persistence and reports invalid syntax and samples', async () => {
  const response = await preview(
    request('POST', { template: input, sample: { customerName: 'Preview' } })
  );
  expect(response.status).toBe(200);
  expect((await response.json()).subject).toContain('Preview');
  expect(mocks.create).not.toHaveBeenCalled();
  expect(
    (await preview(request('POST', { template: input, sample: {} }))).status
  ).toBe(400);
  expect(
    (await POST(request('POST', { ...input, htmlTemplate: '{{#each items}}' })))
      .status
  ).toBe(400);
});
