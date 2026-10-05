import 'server-only';

import { EventType, OrderStatus } from '@prisma/client';
import { prisma } from '@jssprz/ludo2go-database';
import { Resend } from 'resend';

const REPORT_TIME_ZONE = 'America/Santiago';

type Period = { start: Date; end: Date };
type Ranking = { label: string; count: number };
type WeeklyData = {
  orders: number;
  revenue: Map<string, number>;
  sessions: number;
  productViews: number;
  searches: number;
  matchStarts: number;
  matchResults: number;
  bestSellers: Ranking[];
  viewedProducts: Ranking[];
  searchesByTerm: Ranking[];
  matchProducts: Ranking[];
};

function getLocalDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute'), second: part('second') };
}

function localMidnightToDate(year: number, month: number, day: number, timeZone: string): Date {
  const localAsUtc = Date.UTC(year, month - 1, day);
  let instant = localAsUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const local = getLocalDateParts(new Date(instant), timeZone);
    const representedAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    instant += localAsUtc - representedAsUtc;
  }
  return new Date(instant);
}

export function getWeeklyReportPeriods(now = new Date(), timeZone = REPORT_TIME_ZONE): { current: Period; previous: Period } {
  const local = getLocalDateParts(now, timeZone);
  const currentMonday = new Date(Date.UTC(local.year, local.month - 1, local.day));
  currentMonday.setUTCDate(currentMonday.getUTCDate() - ((currentMonday.getUTCDay() + 6) % 7));
  const previousMonday = new Date(currentMonday);
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
  const previousPreviousMonday = new Date(previousMonday);
  previousPreviousMonday.setUTCDate(previousPreviousMonday.getUTCDate() - 7);

  const toLocalMidnight = (date: Date) => localMidnightToDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    timeZone
  );
  const start = toLocalMidnight(currentMonday);
  const previousStart = toLocalMidnight(previousMonday);
  const previousPreviousStart = toLocalMidnight(previousPreviousMonday);
  return {
    current: { start: previousStart, end: start },
    previous: { start: previousPreviousStart, end: previousStart },
  };
}

function asProperties(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function firstString(properties: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function ranking(map: Map<string, number>, limit = 5): Ranking[] {
  return Array.from(map, ([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

async function loadPeriod(period: Period): Promise<{
  data: WeeklyData;
}> {
  const [orders, events] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: period.start, lt: period.end },
        status: { not: OrderStatus.cancelled },
      },
      select: {
        total: true,
        currency: true,
        items: { select: { quantity: true, currency: true, unitPrice: true, variant: { select: { product: { select: { name: true } } } } } },
      },
    }),
    prisma.event.findMany({
      where: {
        occurredAt: { gte: period.start, lt: period.end },
        eventType: { in: [
          EventType.page_view,
          EventType.product_view,
          EventType.search_performed,
          EventType.match_tool_start,
          EventType.match_tool_result_click,
        ] },
      },
      select: { eventType: true, sessionId: true, properties: true, pagePath: true },
    }),
  ]);

  const revenue = new Map<string, number>();
  const sellerCounts = new Map<string, number>();
  for (const order of orders) {
    revenue.set(order.currency, (revenue.get(order.currency) ?? 0) + order.total);
    for (const item of order.items) {
      const label = item.variant.product.name;
      sellerCounts.set(label, (sellerCounts.get(label) ?? 0) + item.quantity);
    }
  }

  const sessions = new Set<string>();
  const viewCounts = new Map<string, number>();
  const searchCounts = new Map<string, number>();
  const matchProductCounts = new Map<string, number>();
  let productViews = 0;
  let searches = 0;
  let matchStarts = 0;
  let matchResults = 0;

  for (const event of events) {
    sessions.add(event.sessionId);
    const properties = asProperties(event.properties);
    if (event.eventType === EventType.product_view) {
      productViews += 1;
      const product = firstString(properties, ['productName', 'productTitle', 'name', 'productSlug', 'productId'])
        ?? event.pagePath?.split('/').filter(Boolean).pop()
        ?? 'Producto sin identificar';
      viewCounts.set(product, (viewCounts.get(product) ?? 0) + 1);
    } else if (event.eventType === EventType.search_performed) {
      searches += 1;
      const term = firstString(properties, ['query', 'search', 'term', 'text', 'value', 'keyword', 'searchQuery', 'searchTerm'])
        ?? 'Búsqueda sin término';
      const normalized = term.toLocaleLowerCase('es-CL');
      searchCounts.set(normalized, (searchCounts.get(normalized) ?? 0) + 1);
    } else if (event.eventType === EventType.match_tool_start) {
      matchStarts += 1;
    } else if (event.eventType === EventType.match_tool_result_click) {
      matchResults += 1;
      const result = firstString(properties, ['name', 'productName', 'productTitle']);
      if (result) matchProductCounts.set(result, (matchProductCounts.get(result) ?? 0) + 1);
    }
  }

  return {
    data: {
      orders: orders.length,
      revenue,
      sessions: sessions.size,
      productViews,
      searches,
      matchStarts,
      matchResults,
      bestSellers: ranking(sellerCounts),
      viewedProducts: ranking(viewCounts),
      searchesByTerm: ranking(searchCounts),
      matchProducts: ranking(matchProductCounts),
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: REPORT_TIME_ZONE }).format(date);
}

function formatChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '0%' : 'Nuevo';
  const percent = Math.round(((current - previous) / previous) * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString('es-CL')} ${currency}`;
  }
}

function rankingSection(title: string, current: Ranking[], previous: Ranking[]): string {
  if (!current.length) return `<h2>${title}</h2><p>Sin datos esta semana.</p>`;
  const previousCounts = new Map(previous.map((item) => [item.label.toLocaleLowerCase('es-CL'), item.count]));
  const rows = current.map((item) => {
    const prior = previousCounts.get(item.label.toLocaleLowerCase('es-CL')) ?? 0;
    return `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${escapeHtml(item.label)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${item.count}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#64748b">${formatChange(item.count, prior)}</td></tr>`;
  }).join('');
  return `<h2>${title}</h2><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px 10px">Ranking</th><th style="text-align:right;padding:6px 10px">Esta semana</th><th style="text-align:right;padding:6px 10px">vs. anterior</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildEmail(current: WeeklyData, previous: WeeklyData, period: Period): { subject: string; text: string; html: string } {
  const metrics: [string, number, number][] = [
    ['Pedidos (sin cancelados)', current.orders, previous.orders],
    ['Sesiones', current.sessions, previous.sessions],
    ['Vistas de producto', current.productViews, previous.productViews],
    ['Búsquedas', current.searches, previous.searches],
    ['Inicios de Match Tool', current.matchStarts, previous.matchStarts],
    ['Clics en recomendaciones', current.matchResults, previous.matchResults],
  ];
  const metricRows = metrics.map(([label, value, prior]) =>
    `<tr><td style="padding:7px 10px;border-bottom:1px solid #e5e7eb">${label}</td><td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${value.toLocaleString('es-CL')}</td><td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#64748b">${formatChange(value, prior)}</td></tr>`
  ).join('');
  const currencyCodes = new Set(Array.from(current.revenue.keys()).concat(Array.from(previous.revenue.keys())));
  const revenueLines = Array.from(currencyCodes, (currency) => {
    const value = current.revenue.get(currency) ?? 0;
    const prior = previous.revenue.get(currency) ?? 0;
    return `${formatCurrency(value, currency)} (${formatChange(value, prior)})`;
  });
  const range = `${formatDate(period.start)} - ${formatDate(new Date(period.end.getTime() - 1))}`;
  const sections = [
    rankingSection('Productos más vendidos (unidades)', current.bestSellers, previous.bestSellers),
    rankingSection('Productos más vistos', current.viewedProducts, previous.viewedProducts),
    rankingSection('Búsquedas más frecuentes', current.searchesByTerm, previous.searchesByTerm),
    rankingSection('Productos más elegidos en Match Tool', current.matchProducts, previous.matchProducts),
  ].join('');
  const textRankings = [
    ['Más vendidos', current.bestSellers],
    ['Más vistos', current.viewedProducts],
    ['Búsquedas', current.searchesByTerm],
    ['Match Tool', current.matchProducts],
  ].map(([title, items]) => `${title}:\n${(items as Ranking[]).map((item) => `- ${item.label}: ${item.count}`).join('\n') || '- Sin datos'}`).join('\n\n');
  return {
    subject: `Resumen semanal de analíticas | ${range}`,
    text: [
      `Resumen semanal (${range})`,
      'Comparación con los 7 días anteriores:',
      ...metrics.map(([label, value, prior]) => `${label}: ${value} (${formatChange(value, prior)})`),
      `Ventas: ${revenueLines.join(' | ') || 'Sin ventas'}`,
      textRankings,
    ].join('\n'),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#1f2937;max-width:720px;margin:0 auto"><h1 style="font-size:24px">Resumen semanal de analíticas</h1><p style="color:#64748b">${range} · comparación con los 7 días anteriores</p><h2>Indicadores</h2><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:7px 10px">Indicador</th><th style="text-align:right;padding:7px 10px">Esta semana</th><th style="text-align:right;padding:7px 10px">vs. anterior</th></tr></thead><tbody>${metricRows}</tbody></table><p><strong>Ventas (sin cancelados):</strong> ${revenueLines.map(escapeHtml).join(' · ') || 'Sin ventas'}</p>${sections}<p style="margin-top:28px;color:#64748b;font-size:12px">Informe automático de Jobys.</p></div>`,
  };
}

export async function sendWeeklyAnalyticsReport(now = new Date()): Promise<{ sent: number; period: Period }> {
  const periods = getWeeklyReportPeriods(now);
  const [current, previous, admins] = await Promise.all([
    loadPeriod(periods.current),
    loadPeriod(periods.previous),
    prisma.adminUser.findMany({
      where: { email: { not: '' }, role: { key: 'SUPER_ADMIN' } },
      select: { email: true },
    }),
  ]);
  const recipients = Array.from(new Set(admins.map((admin) => admin.email.trim()).filter(Boolean)));
  if (!recipients.length) return { sent: 0, period: periods.current };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured.');
  const email = buildEmail(current.data, previous.data, periods.current);
  const resend = new Resend(apiKey);
  const results = await Promise.all(recipients.map((to) => resend.emails.send({
    from: 'Jobys Reports <reports@jobys.cl>',
    to,
    ...email,
    tags: [{ name: 'type', value: 'weekly_analytics_report' }],
  })));
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw new Error(`Weekly analytics email failed: ${failure.message}`);
  return { sent: recipients.length, period: periods.current };
}