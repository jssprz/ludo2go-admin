import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GuideStatus } from '@prisma/client';
import { GET } from '../app/api/cron/publish-guides/route';

const mocks = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock('@jssprz/ludo2go-database', () => ({ prisma: { guide: { updateMany: mocks.updateMany } } }));

const now = new Date('2026-10-18T00:00:00Z');

function request(authorization: string | null = 'Bearer test-cron-secret') {
  return new Request('https://admin.example.com/api/cron/publish-guides', {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  mocks.updateMany.mockReset();
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  vi.useFakeTimers();
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

test('fails closed when cron authentication is not configured', async () => {
  vi.stubEnv('CRON_SECRET', '');
  expect((await GET(request())).status).toBe(503);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});

test.each([null, 'Bearer incorrect', 'test-cron-secret'])('rejects unauthorized requests (%s)', async (authorization) => {
  expect((await GET(request(authorization))).status).toBe(401);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});

test('atomically publishes only due scheduled guides and sets publication timestamps', async () => {
  mocks.updateMany.mockResolvedValue({ count: 2 });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, published: 2 });
  expect(mocks.updateMany).toHaveBeenCalledExactlyOnceWith({
    where: { status: GuideStatus.scheduled, scheduledAt: { lte: now } },
    data: { status: GuideStatus.published, publishedAt: now, scheduledAt: null },
  });
});

test('repeated runs succeed without republishing guides or changing future and unscheduled guides', async () => {
  const guides = [
    { status: 'scheduled', scheduledAt: new Date('2026-10-17T23:59:59Z') },
    { status: 'scheduled', scheduledAt: now },
    { status: 'scheduled', scheduledAt: new Date('2026-10-18T00:00:01Z') },
    { status: 'scheduled', scheduledAt: null },
    { status: 'draft', scheduledAt: new Date('2026-10-17T12:00:00Z') },
    { status: 'archived', scheduledAt: new Date('2026-10-17T12:00:00Z') },
    { status: 'published', scheduledAt: new Date('2026-10-17T12:00:00Z') },
  ];
  mocks.updateMany.mockImplementation(async ({ where, data }) => {
    let count = 0;
    for (const guide of guides) {
      if (guide.status === where.status && guide.scheduledAt && guide.scheduledAt <= where.scheduledAt.lte) {
        Object.assign(guide, data);
        count += 1;
      }
    }
    return { count };
  });
  expect(await (await GET(request())).json()).toEqual({ ok: true, published: 2 });
  expect(await (await GET(request())).json()).toEqual({ ok: true, published: 0 });
  expect(guides.map((guide) => guide.status)).toEqual(['published', 'published', 'scheduled', 'scheduled', 'draft', 'archived', 'published']);
  expect(guides[2].scheduledAt).toEqual(new Date('2026-10-18T00:00:01Z'));
});

test('returns an error when the database update fails', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    mocks.updateMany.mockRejectedValue(new Error('Database unavailable'));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Scheduled guide publishing failed.' });
  } finally {
    log.mockRestore();
  }
});