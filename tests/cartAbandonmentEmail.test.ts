import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { findMany, send } = vi.hoisted(() => ({
  findMany: vi.fn(),
  send: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@jssprz/ludo2go-database', () => ({
  prisma: { adminUser: { findMany } },
}));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendCartAbandonmentReport } from '../lib/cart-abandonment-email';

const report = {
  startedAt: new Date('2026-11-09T11:00:00Z'),
  completedAt: new Date('2026-11-09T11:00:01Z'),
  cutoff: new Date('2026-10-10T11:00:00Z'),
  counts: {
    active: 6, abandoned: 4,
    customers: { active: 2, abandoned: 1 },
    anonymousVisitors: { active: 4, abandoned: 3 },
  },
};

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM_EMAIL', '');
  findMany.mockReset();
  send.mockReset();
  findMany.mockResolvedValue([
    { email: 'first@example.com' },
    { email: ' second@example.com ' },
    { email: 'first@example.com' },
    { email: ' ' },
  ]);
  send.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('reports active and abandoned counts, cutoff and run dates to every unique admin email', async () => {
  expect(await sendCartAbandonmentReport(report)).toBe(2);
  expect(findMany).toHaveBeenCalledExactlyOnceWith({
    where: { email: { not: '' } },
    select: { email: true },
  });
  expect(send).toHaveBeenCalledTimes(2);
  ['first@example.com', 'second@example.com'].forEach((to, index) => {
    expect(send).toHaveBeenNthCalledWith(index + 1, expect.objectContaining({
      from: 'Jobys Reports <reports@jobys.cl>',
      to,
      subject: 'Jobys: informe de actividad de carritos - 6 activos / 4 abandonados',
      text: expect.stringContaining('Carritos abandonados: 4'),
    }));
  });
  const message = send.mock.calls[0][0].text;
  expect(message).toContain('Carritos activos: 6');
  expect(message).toContain('Carritos activos: 6\n  Clientes: 2\n  Visitantes anónimos: 4');
  expect(message).toContain('Carritos abandonados: 4\n  Clientes: 1\n  Visitantes anónimos: 3');
  expect(message).toContain('Total de carritos no ordenados: 10');
  expect(message).toContain('no se modifica el estado');
  expect(message).toContain('Inicio:');
  expect(message).toContain('Fin:');
  expect(message).toContain('Corte de inactividad (30 días):');
  const formatDate = (date: Date) => new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'long',
    timeZone: 'America/Santiago',
  }).format(date);
  expect(message).toContain(`Inicio: ${formatDate(report.startedAt)}`);
  expect(message).toContain(`Fin: ${formatDate(report.completedAt)}`);
  expect(message).toContain(`Corte de inactividad (30 días): ${formatDate(report.cutoff)}`);
});

test('zero-count runs still send a report and respect the configured sender', async () => {
  vi.stubEnv('RESEND_FROM_EMAIL', 'Reports <reports@example.com>');
  await sendCartAbandonmentReport({
    ...report,
    counts: {
      active: 0, abandoned: 0,
      customers: { active: 0, abandoned: 0 },
      anonymousVisitors: { active: 0, abandoned: 0 },
    },
  });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    from: 'Reports <reports@example.com>',
    text: expect.stringContaining('Carritos abandonados: 0'),
  }));
  expect(send.mock.calls[0][0].text)
    .toContain('Carritos activos: 0\n  Clientes: 0\n  Visitantes anónimos: 0');
});

test('failed queries report unknown counts rather than zero', async () => {
  await sendCartAbandonmentReport({ ...report, counts: null });
  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    subject: 'Jobys: informe de actividad de carritos - fallido',
    text: expect.stringContaining('No se pudieron determinar los números de carritos.'),
  }));
});

test('missing recipients and missing email configuration fail explicitly', async () => {
  findMany.mockResolvedValue([]);
  await expect(sendCartAbandonmentReport(report)).rejects.toThrow('No admin email recipients');
  findMany.mockResolvedValue([{ email: 'first@example.com' }]);
  vi.stubEnv('RESEND_API_KEY', '');
  await expect(sendCartAbandonmentReport(report)).rejects.toThrow('RESEND_API_KEY');
  expect(send).not.toHaveBeenCalled();
});

test('provider errors and thrown failures propagate to the cron endpoint', async () => {
  send.mockResolvedValue({ error: { message: 'Rejected' } });
  await expect(sendCartAbandonmentReport(report)).rejects.toThrow('Rejected');
  send.mockRejectedValue(new Error('Network failure'));
  await expect(sendCartAbandonmentReport(report)).rejects.toThrow('Network failure');
});
