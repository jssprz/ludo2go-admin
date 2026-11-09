import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const { queryRaw, updateMany, sendReport } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  updateMany: vi.fn(),
  sendReport: vi.fn(),
}));

vi.mock('@/lib/cart-abandonment-email', () => ({
  sendCartAbandonmentReport: sendReport,
}));
vi.mock('@/lib/cart-activity', async () => import('../lib/cart-activity'));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/repositories/cart-activity', async () => import('../lib/repositories/cart-activity'));
vi.mock('@jssprz/ludo2go-database', () => ({
  prisma: { cart: { updateMany }, $queryRaw: queryRaw }
}));

import { GET } from '../app/api/cron/abandon-carts/route';

const counts = {
  active: 6,
  abandoned: 4,
  customers: { active: 2, abandoned: 1 },
  anonymousVisitors: { active: 4, abandoned: 3 },
};

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-09T11:00:00Z'));
  queryRaw.mockReset();
  updateMany.mockReset();
  sendReport.mockReset();
  queryRaw.mockResolvedValue([{
    customerActive: 2, customerAbandoned: 1, anonymousActive: 4, anonymousAbandoned: 3,
  }]);
  sendReport.mockResolvedValue(2);
});

afterEach(() => {
  expect(updateMany).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function request(authorization?: string) {
  return new Request('https://admin.example/api/cron/abandon-carts', {
    headers: authorization ? { authorization } : {}
  });
}

test('rejects missing configuration and unauthorized requests before querying or emailing', async () => {
  vi.stubEnv('CRON_SECRET', '');
  expect((await GET(request())).status).toBe(503);
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
  for (const authorization of [undefined, 'Bearer wrong-secret']) {
    expect((await GET(request(authorization))).status).toBe(401);
  }
  expect(queryRaw).not.toHaveBeenCalled();
  expect(sendReport).not.toHaveBeenCalled();
});

test('counts active and abandoned carts by owner in a single read-only snapshot', async () => {
  const response = await GET(request('Bearer test-cron-secret'));
  const cutoff = new Date('2026-10-10T11:00:00Z');
  expect(queryRaw).toHaveBeenCalledTimes(1);
  const query = queryRaw.mock.calls[0][0];
  expect(query.values).toEqual([cutoff, cutoff]);
  expect(query.text).toContain("cart.status::text IN ('active', 'abandoned')");
  expect(query.text).not.toMatch(/\b(UPDATE|INSERT|DELETE)\b/);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, ...counts, reportsSent: 2 });
  expect(sendReport).toHaveBeenCalledExactlyOnceWith({
    startedAt: new Date('2026-11-09T11:00:00Z'),
    completedAt: new Date('2026-11-09T11:00:00Z'),
    cutoff,
    counts,
  });
});

test('zero-count runs and retries still send the snapshot report', async () => {
  queryRaw.mockResolvedValue([{
    customerActive: 0, customerAbandoned: 0, anonymousActive: 0, anonymousAbandoned: 0,
  }]);
  for (let run = 0; run < 2; run += 1) {
    expect(await (await GET(request('Bearer test-cron-secret'))).json())
      .toEqual({
        ok: true, active: 0, abandoned: 0, reportsSent: 2,
        customers: { active: 0, abandoned: 0 },
        anonymousVisitors: { active: 0, abandoned: 0 },
      });
  }
  expect(sendReport).toHaveBeenCalledTimes(2);
});

test('database failures are logged and reported with unknown counts', async () => {
  const error = new Error('Database unavailable');
  queryRaw.mockRejectedValue(error);
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await GET(request('Bearer test-cron-secret'));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'Scheduled cart activity count failed.', reportsSent: 2 });
  expect(log).toHaveBeenCalledWith('Scheduled cart activity count failed:', error);
  expect(sendReport).toHaveBeenCalledWith(expect.objectContaining({ counts: null }));
});

test('email failures explicitly return the counted snapshot', async () => {
  sendReport.mockRejectedValue(new Error('Email unavailable'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await GET(request('Bearer test-cron-secret'));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: 'Cart activity counted, but report delivery failed.',
    counts,
  });
});

test('combined query and email failures do not claim a successful run', async () => {
  queryRaw.mockRejectedValue(new Error('Database unavailable'));
  sendReport.mockRejectedValue(new Error('Email unavailable'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const response = await GET(request('Bearer test-cron-secret'));
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: 'Cart activity counting and report delivery failed.',
    counts: null,
  });
});

test('Vercel retains the weekly Monday 11:00 UTC schedule', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  expect(config.crons).toContainEqual({
    path: '/api/cron/abandon-carts',
    schedule: '0 11 * * 1'
  });
});
