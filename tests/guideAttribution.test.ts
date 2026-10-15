import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), admin: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(),
  transaction: vi.fn(), blockFind: vi.fn(), parseBlock: vi.fn(), saveBlock: vi.fn(), deleteBlock: vi.fn(), parseSort: vi.fn(), sortBlocks: vi.fn(),
  associationFind: vi.fn(), associationCreate: vi.fn(), associationDelete: vi.fn(), variantFind: vi.fn()
}));
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@jssprz/ludo2go-database', () => ({ prisma: {
  adminUser: { findUnique: mocks.admin },
  guide: { findUnique: mocks.findUnique, findFirst: mocks.findFirst, create: mocks.create, update: mocks.update },
  guideBlock: { findUnique: mocks.blockFind },
  guideProductVariant: { findUnique: mocks.associationFind, create: mocks.associationCreate, delete: mocks.associationDelete },
  productVariant: { findUnique: mocks.variantFind },
  $transaction: mocks.transaction
} }));
vi.mock('@/lib/guide-block-persistence', () => ({
  parseGuideBlockRequest: mocks.parseBlock, saveGuideBlock: mocks.saveBlock,
  deleteGuideBlock: mocks.deleteBlock, parseGuideBlockSortRequest: mocks.parseSort,
  sortGuideBlocks: mocks.sortBlocks, guideBlockErrorResponse: () => null,
  GuideBlockError: class extends Error {}
}));

import { POST } from '../app/api/guides/route';
import { PUT } from '../app/api/guides/[id]/route';
import { guideCreateAttribution, guideEditAttribution, resolveGuideActor } from '../lib/guide-attribution';
import { POST as createBlock } from '../app/api/guide-blocks/route';
import { PUT as updateBlock, DELETE as deleteBlock } from '../app/api/guide-blocks/[id]/route';
import { PUT as reorderBlocks } from '../app/api/guide-blocks/sort/route';
import { POST as addVariant, DELETE as removeVariant } from '../app/api/guide-product-variants/[id]/route';
import { NextRequest } from 'next/server';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: 'admin-1' } });
  mocks.admin.mockResolvedValue({ id: 'admin-1', firstName: 'Ana', lastName: 'Perez', username: 'ana', email: 'ana@example.com' });
  mocks.findUnique.mockResolvedValue(null);
  mocks.findFirst.mockResolvedValue(null);
  mocks.create.mockImplementation(async ({ data }) => ({ id: 'guide-1', ...data }));
  mocks.update.mockImplementation(async ({ data }) => ({ id: 'guide-1', ...data }));
  mocks.blockFind.mockResolvedValue({ guideId: 'guide-1' });
  mocks.parseBlock.mockResolvedValue({ guideId: 'guide-1', type: 'heading', title: 'Heading' });
  mocks.saveBlock.mockResolvedValue({ id: 'block-1', guideId: 'guide-1' });
  mocks.parseSort.mockResolvedValue([{ id: 'block-1', sortOrder: 0 }]);
  mocks.associationFind.mockResolvedValue(null);
  mocks.associationCreate.mockResolvedValue({ guideId: 'guide-1', variantId: 'variant-1' });
  mocks.associationDelete.mockResolvedValue({ guideId: 'guide-1', variantId: 'variant-1' });
  mocks.variantFind.mockResolvedValue({ id: 'variant-1' });
  mocks.transaction.mockImplementation(async (callback) => callback({
    adminUser: { findUnique: mocks.admin }, guide: { update: mocks.update },
    guideBlock: { findUnique: mocks.blockFind },
    guideProductVariant: { create: mocks.associationCreate, delete: mocks.associationDelete }
  }));
});

function request(method: string) {
  return new Request('http://localhost/api/guides', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    title: 'Guide', slug: 'guide', status: 'draft', authorId: 'forged-author', authorName: 'Forged author', editorId: 'forged-editor', editorName: 'Forged editor'
  }) });
}

function scheduleRequest(method: string, status: string, scheduledAt?: unknown) {
  return new Request('http://localhost/api/guides', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Guide', slug: 'guide', status, scheduledAt }) });
}

test('scheduled creation persists the chosen UTC instant and remains scheduled', async () => {
  const response = await POST(scheduleRequest('POST', 'scheduled', '2099-05-01T10:30:00-03:00'));
  expect(response.status).toBe(201);
  const data = mocks.create.mock.calls[0][0].data;
  expect(data.status).toBe('scheduled');
  expect(data.scheduledAt.toISOString()).toBe('2099-05-01T13:30:00.000Z');
  expect(data.publishedAt).toBeNull();
});

test.each([undefined, null, 'bad', '2020-01-01T12:00:00Z'])('invalid scheduling date %s is rejected by create and update before persistence', async (date) => {
  expect((await POST(scheduleRequest('POST', 'scheduled', date))).status).toBe(400);
  if (date === undefined) mocks.findUnique.mockResolvedValueOnce({ status: 'draft', scheduledAt: null });
  expect((await PUT(scheduleRequest('PUT', 'scheduled', date), { params: Promise.resolve({ id: 'guide-1' }) })).status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

test('rescheduling updates the stored date and changing to draft clears it', async () => {
  const params = { params: Promise.resolve({ id: 'guide-1' }) };
  expect((await PUT(scheduleRequest('PUT', 'scheduled', '2099-05-01T13:30:00Z'), params)).status).toBe(200);
  expect(mocks.update.mock.calls[0][0].data.scheduledAt.toISOString()).toBe('2099-05-01T13:30:00.000Z');
  expect((await PUT(scheduleRequest('PUT', 'draft', null), params)).status).toBe(200);
  expect(mocks.update.mock.calls[1][0].data.scheduledAt).toBeNull();
});

test('metadata-only saves preserve an existing scheduled date when schedule is omitted', async () => {
  const scheduledAt = new Date('2099-05-01T13:30:00Z');
  mocks.findUnique.mockResolvedValueOnce({ status: 'scheduled', scheduledAt });
  const response = await PUT(new Request('http://localhost/api/guides', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Guide', slug: 'guide' }) }), { params: Promise.resolve({ id: 'guide-1' }) });
  expect(response.status).toBe(200);
  expect(mocks.update.mock.calls[0][0].data.scheduledAt).toEqual(scheduledAt);
});

test('creation records authenticated admin as both author and editor, ignoring submitted attribution', async () => {
  const response = await POST(request('POST'));
  expect(response.status).toBe(201);
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ authorId: 'admin-1', authorName: 'Ana Perez', editorId: 'admin-1', editorName: 'Ana Perez' });
});

test('metadata updates preserve the original author and record only the current editor', async () => {
  const response = await PUT(request('PUT'), { params: Promise.resolve({ id: 'guide-1' }) });
  expect(response.status).toBe(200);
  const data = mocks.update.mock.calls[0][0].data;
  expect(data).not.toHaveProperty('authorId');
  expect(data).not.toHaveProperty('authorName');
  expect(data).toMatchObject({ editorId: 'admin-1', editorName: 'Ana Perez' });
});

test('missing sessions and deleted admin identities cannot write attribution', async () => {
  mocks.auth.mockResolvedValueOnce({ user: {} });
  expect((await POST(request('POST'))).status).toBe(401);
  mocks.admin.mockResolvedValue(null);
  expect((await PUT(request('PUT'), { params: Promise.resolve({ id: 'guide-1' }) })).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

test('actor names use the existing full-name, username, email fallback', async () => {
  const database = { adminUser: { findUnique: mocks.admin } } as unknown as Parameters<typeof resolveGuideActor>[0];
  mocks.admin.mockResolvedValueOnce({ id: 'admin-1', firstName: null, lastName: null, username: 'ana', email: 'ana@example.com' });
  expect(await resolveGuideActor(database, 'admin-1')).toEqual({ id: 'admin-1', name: 'ana' });
  mocks.admin.mockResolvedValueOnce({ id: 'admin-1', firstName: null, lastName: null, username: null, email: 'ana@example.com' });
  expect(await resolveGuideActor(database, 'admin-1')).toEqual({ id: 'admin-1', name: 'ana@example.com' });
  const actor = { id: 'admin-1', name: 'Ana' };
  expect(guideCreateAttribution(actor)).toEqual({ authorId: actor.id, authorName: actor.name, editorId: actor.id, editorName: actor.name });
  expect(guideEditAttribution(actor)).toEqual({ editorId: actor.id, editorName: actor.name });
});

test.each(['create', 'update', 'delete', 'reorder', 'addVariant', 'removeVariant'])('%s child mutation records only last editor inside its transaction', async (operation) => {
  const params = { params: Promise.resolve({ id: operation.includes('Variant') ? 'guide-1' : 'block-1' }) };
  const body = new NextRequest('http://localhost/api/guides?variantId=variant-1', {
    method: 'POST', body: JSON.stringify({ variantId: 'variant-1' }), headers: { 'Content-Type': 'application/json' }
  });
  mocks.findUnique.mockResolvedValue({ id: 'guide-1' });
  const response = operation === 'create' ? await createBlock(body)
    : operation === 'update' ? await updateBlock(body, params)
    : operation === 'delete' ? await deleteBlock(body, params)
    : operation === 'reorder' ? await reorderBlocks(body)
    : operation === 'addVariant' ? await addVariant(body, params)
    : await removeVariant(body, params);
  expect(response.status).toBeLessThan(300);
  expect(mocks.transaction).toHaveBeenCalledTimes(1);
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'guide-1' }, data: { editorId: 'admin-1', editorName: 'Ana Perez' } });
});

test('failed block saves do not record a new editor', async () => {
  mocks.saveBlock.mockRejectedValue(new Error('Storage unavailable'));
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await createBlock(request('POST'));
    expect(response.status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  } finally { consoleError.mockRestore(); }
});