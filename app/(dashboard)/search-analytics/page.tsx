import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@jssprz/ludo2go-database';
import { EventType } from '@prisma/client';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { GroupedQueryTable } from './grouped-query-table';
import {
  ADMIN_TIME_ZONE_COOKIE,
  formatDateInTimeZone,
  normalizeTimeZone,
} from '@/lib/date-time';

const formatDateTime = (date: Date, locale: string, timeZone: string) => {
  return formatDateInTimeZone(date, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }, locale, timeZone)
}

function getSearchQueriesFromProperties(properties: unknown): { rawQuery: string | null; normalizedQuery: string | null } {
  if (!properties || typeof properties !== 'object') {
    return { rawQuery: null, normalizedQuery: null };
  }

  const props = properties as {
    normalizedQuery?: unknown;
    query?: unknown;
    search?: unknown;
    term?: unknown;
    text?: unknown;
    value?: unknown;
    keyword?: unknown;
    searchQuery?: unknown;
    searchTerm?: unknown;
    filters?: { query?: unknown };
  };

  const rawCandidates = [
    props.query,
    props.search,
    props.term,
    props.text,
    props.value,
    props.keyword,
    props.searchQuery,
    props.searchTerm,
    props.filters?.query,
  ];

  let rawQuery: string | null = null;
  for (const candidate of rawCandidates) {
    if (typeof candidate === 'string') {
      const raw = candidate.trim();
      if (raw.length > 0) {
        rawQuery = raw;
        break;
      }
    }
  }

  let normalizedQuery: string | null = null;
  if (typeof props.normalizedQuery === 'string') {
    const normalized = props.normalizedQuery.trim().toLowerCase();
    if (normalized.length > 0) normalizedQuery = normalized;
  }

  if (!normalizedQuery && rawQuery) {
    normalizedQuery = rawQuery.toLowerCase();
  }

  return { rawQuery, normalizedQuery };
}

function getResultCountFromProperties(properties: unknown): number | null {
  if (!properties || typeof properties !== 'object') {
    return null;
  }

  const props = properties as {
    resultCount?: unknown;
  };

  if (typeof props.resultCount === 'number' && Number.isFinite(props.resultCount)) {
    return Math.max(0, props.resultCount);
  }

  if (typeof props.resultCount === 'string') {
    const parsed = Number(props.resultCount.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return null;
}

function getTypeaheadQueriesFromProperties(properties: unknown): { rawQuery: string | null; normalizedQuery: string | null } {
  if (!properties || typeof properties !== 'object') {
    return { rawQuery: null, normalizedQuery: null };
  }

  const props = properties as {
    normalizedQuery?: unknown;
    query?: unknown;
    search?: unknown;
    term?: unknown;
    text?: unknown;
    value?: unknown;
    keyword?: unknown;
    searchQuery?: unknown;
    searchTerm?: unknown;
    filters?: { query?: unknown };
  };

  const rawCandidates = [
    props.query,
    props.search,
    props.term,
    props.text,
    props.value,
    props.keyword,
    props.searchQuery,
    props.searchTerm,
    props.filters?.query,
  ];

  let rawQuery: string | null = null;
  for (const candidate of rawCandidates) {
    if (typeof candidate === 'string') {
      const raw = candidate.trim();
      if (raw.length > 0) {
        rawQuery = raw;
        break;
      }
    }
  }

  let normalizedQuery: string | null = null;
  if (typeof props.normalizedQuery === 'string') {
    const normalized = props.normalizedQuery.trim().toLowerCase();
    if (normalized.length > 0) normalizedQuery = normalized;
  }

  if (!normalizedQuery && rawQuery) {
    normalizedQuery = rawQuery.toLowerCase();
  }

  return { rawQuery, normalizedQuery };
}

function getTypeaheadResultCountFromProperties(properties: unknown): number | null {
  if (!properties || typeof properties !== 'object') {
    return null;
  }

  const props = properties as {
    resultCount?: unknown;
    productCount?: unknown;
    suggestionCount?: unknown;
    itemCount?: unknown;
  };

  const parseCount = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, value);
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return Math.max(0, parsed);
      }
    }

    return null;
  };

  const explicitResultCount = parseCount(props.resultCount);
  if (explicitResultCount !== null) {
    return explicitResultCount;
  }

  const itemCount = parseCount(props.itemCount);
  if (itemCount !== null) {
    return itemCount;
  }

  const productCount = parseCount(props.productCount);
  const suggestionCount = parseCount(props.suggestionCount);

  if (productCount !== null || suggestionCount !== null) {
    return (productCount ?? 0) + (suggestionCount ?? 0);
  }

  return null;
}

function getClickSourceQuery(properties: unknown): string | null {
  if (!properties || typeof properties !== 'object') {
    return null;
  }

  const props = properties as {
    sourceQuery?: unknown;
    normalizedQuery?: unknown;
    query?: unknown;
    rawQuery?: unknown;
    searchQuery?: unknown;
    searchTerm?: unknown;
    term?: unknown;
  };

  const candidates = [
    props.sourceQuery,
    props.normalizedQuery,
    props.query,
    props.rawQuery,
    props.searchQuery,
    props.searchTerm,
    props.term,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const normalized = candidate.trim().toLowerCase();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return null;
}

function getAtcQueryFromProperties(properties: unknown): string | null {
  if (!properties || typeof properties !== 'object') return null;
  const props = properties as { attributionSourceKey?: unknown };
  if (typeof props.attributionSourceKey !== 'string') return null;
  const key = props.attributionSourceKey;
  try {
    const params = new URLSearchParams(key);
    const q = params.get('q');
    if (q && q.trim().length > 0) return q.trim().toLowerCase();
  } catch {
    // ignore malformed keys
  }
  return null;
}

function getDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWeekKey(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day);
  return utcDate.toISOString().slice(0, 10);
}

function getInclusiveDaySpan(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(1, Math.floor((endUtc - startUtc) / 86_400_000) + 1);
}

export default async function SearchAnalyticsPage() {
  const t = await getTranslations('dashboard');
  const td = await getTranslations('dashboardPage');
  const locale = await getLocale();
  const cookieStore = await cookies();
  const timeZone = normalizeTimeZone(cookieStore.get(ADMIN_TIME_ZONE_COOKIE)?.value);

  const [searchEvents, clickEvents, typeaheadEvents, typeaheadClickEvents, atcEvents] = await Promise.all([
    prisma.event.findMany({
      where: { eventType: EventType.search_performed },
      select: { occurredAt: true, properties: true },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.event.findMany({
      where: { eventType: 'search_result_click' as EventType },
      select: { properties: true },
    }),
    prisma.event.findMany({
      where: { eventType: 'typeahead_performed' as EventType },
      select: { occurredAt: true, properties: true },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.event.findMany({
      where: { eventType: 'typeahead_result_click' as EventType },
      select: { properties: true },
    }),
    prisma.event.findMany({
      where: { eventType: 'add_to_cart' as EventType },
      select: { properties: true },
    }),
  ]);

  // Build ATC counts per normalized query from attributionSourceKey "q=<query>"
  const atcsByNormalizedQuery = new Map<string, number>();
  for (const atcEvent of atcEvents) {
    const key = getAtcQueryFromProperties(atcEvent.properties);
    if (!key) continue;
    atcsByNormalizedQuery.set(key, (atcsByNormalizedQuery.get(key) ?? 0) + 1);
  }

  // Build clicks-per-normalizedQuery map from search_result_click events
  const clicksByNormalizedQuery = new Map<string, number>();
  for (const clickEvent of clickEvents) {
    const key = getClickSourceQuery(clickEvent.properties);
    if (!key) continue;
    clicksByNormalizedQuery.set(key, (clicksByNormalizedQuery.get(key) ?? 0) + 1);
  }

  const searchTermStats = new Map<
    string,
    {
      normalizedQuery: string | null;
      count: number;
      firstAt: Date;
      lastAt: Date;
      rawQueryCounts: Map<string, number>;
    }
  >();
  const searchByDay = new Map<string, number>();
  const searchByWeek = new Map<string, number>();
  const weekdaySearchByDay = new Map<string, number>();
  const uniqueNormalizedTerms = new Set<string>();
  let totalResultCount = 0;
  let searchesWithEmptyResults = 0;
  let searchesWithResultCount = 0;

  for (const searchEvent of searchEvents) {
    const { rawQuery, normalizedQuery } = getSearchQueriesFromProperties(searchEvent.properties);
    const resultCount = getResultCountFromProperties(searchEvent.properties);
    const rowKey = normalizedQuery ?? '__unknown_norm__';
    const existing = searchTermStats.get(rowKey);

    uniqueNormalizedTerms.add(normalizedQuery ?? '__unknown_norm__');

    if (!existing) {
      const rawQueryCounts = new Map<string, number>();
      if (rawQuery) {
        rawQueryCounts.set(rawQuery, 1);
      }

      searchTermStats.set(rowKey, {
        normalizedQuery,
        count: 1,
        firstAt: searchEvent.occurredAt,
        lastAt: searchEvent.occurredAt,
        rawQueryCounts,
      });
    } else {
      existing.count += 1;
      if (searchEvent.occurredAt < existing.firstAt) existing.firstAt = searchEvent.occurredAt;
      if (searchEvent.occurredAt > existing.lastAt) existing.lastAt = searchEvent.occurredAt;
      if (rawQuery) {
        existing.rawQueryCounts.set(rawQuery, (existing.rawQueryCounts.get(rawQuery) ?? 0) + 1);
      }
    }

    const dayKey = getDayKey(searchEvent.occurredAt);
    searchByDay.set(dayKey, (searchByDay.get(dayKey) ?? 0) + 1);

    const weekKey = getWeekKey(searchEvent.occurredAt);
    searchByWeek.set(weekKey, (searchByWeek.get(weekKey) ?? 0) + 1);

    const dayOfWeek = searchEvent.occurredAt.getUTCDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdaySearchByDay.set(dayKey, (weekdaySearchByDay.get(dayKey) ?? 0) + 1);
    }

    if (resultCount !== null) {
      searchesWithResultCount += 1;
      totalResultCount += resultCount;
      if (resultCount === 0) {
        searchesWithEmptyResults += 1;
      }
    }
  }

  const searchRows = Array.from(searchTermStats.entries())
    .map(([key, stats]) => {
      const activeDays = getInclusiveDaySpan(stats.firstAt, stats.lastAt);
      const activeWeeks = Math.max(1, Math.ceil(activeDays / 7));
      const clicks = clicksByNormalizedQuery.get(stats.normalizedQuery?.toLowerCase() ?? '') ?? 0;
      const ctr = stats.count > 0 ? (clicks / stats.count) * 100 : 0;
      const atcs = atcsByNormalizedQuery.get(stats.normalizedQuery?.toLowerCase() ?? '') ?? 0;
      const atcRate = stats.count > 0 ? (atcs / stats.count) * 100 : 0;
      const rawQueryEntries = Array.from(stats.rawQueryCounts.entries()).sort((a, b) => b[1] - a[1]);
      const rawQuery = rawQueryEntries[0]?.[0] ?? null;

      return {
        key,
        rawQuery,
        normalizedQuery: stats.normalizedQuery,
        count: stats.count,
        clicks,
        ctr,
        atcs,
        atcRate,
        firstAt: stats.firstAt,
        lastAt: stats.lastAt,
        avgDaily: stats.count / activeDays,
        avgWeekly: stats.count / activeWeeks,
        distinctRawQueryCount: stats.rawQueryCounts.size,
        rawQueryVariants: rawQueryEntries.map(([value, count]) => ({ value, count })),
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return new Date(b.firstAt).getTime() - new Date(a.firstAt).getTime();
    });

  const totalSearches = searchEvents.length;
  const uniqueSearchTerms = uniqueNormalizedTerms.size;
  const avgSearchesDaily = searchByDay.size ? totalSearches / searchByDay.size : 0;
  const avgSearchesWeekly = searchByWeek.size ? totalSearches / searchByWeek.size : 0;
  const weekdayAverageSearches = weekdaySearchByDay.size
    ? Array.from(weekdaySearchByDay.values()).reduce((sum, count) => sum + count, 0) / weekdaySearchByDay.size
    : 0;
  const averageItemsInResults = searchesWithResultCount ? totalResultCount / searchesWithResultCount : 0;
  const emptyResultsRate = searchesWithResultCount ? (searchesWithEmptyResults / searchesWithResultCount) * 100 : 0;
  const firstSearchAt = totalSearches ? searchEvents[0].occurredAt : null;
  const lastSearchAt = totalSearches ? searchEvents[searchEvents.length - 1].occurredAt : null;
  const totalSearchClicks = clickEvents.length;
  const overallSearchCtr = totalSearches > 0 ? (totalSearchClicks / totalSearches) * 100 : 0;
  const totalSearchAtcs = searchRows.reduce((sum, r) => sum + r.atcs, 0);
  const overallSearchAtcRate = totalSearches > 0 ? (totalSearchAtcs / totalSearches) * 100 : 0;

  // Build clicks-per-normalizedQuery map from typeahead_result_click events
  const typeaheadClicksByNormalizedQuery = new Map<string, number>();
  for (const clickEvent of typeaheadClickEvents) {
    const key = getClickSourceQuery(clickEvent.properties);
    if (!key) continue;
    typeaheadClicksByNormalizedQuery.set(key, (typeaheadClicksByNormalizedQuery.get(key) ?? 0) + 1);
  }

  const typeaheadTermStats = new Map<
    string,
    {
      normalizedQuery: string | null;
      count: number;
      firstAt: Date;
      lastAt: Date;
      rawQueryCounts: Map<string, number>;
    }
  >();
  const typeaheadByDay = new Map<string, number>();
  const typeaheadByWeek = new Map<string, number>();
  const weekdayTypeaheadByDay = new Map<string, number>();
  const uniqueNormalizedTypeaheadTerms = new Set<string>();
  let totalTypeaheadResultCount = 0;
  let typeaheadWithEmptyResults = 0;
  let typeaheadWithResultCount = 0;

  for (const typeaheadEvent of typeaheadEvents) {
    const { rawQuery, normalizedQuery } = getTypeaheadQueriesFromProperties(typeaheadEvent.properties);
    const resultCount = getTypeaheadResultCountFromProperties(typeaheadEvent.properties);
    const rowKey = normalizedQuery ?? '__unknown_norm__';
    const existing = typeaheadTermStats.get(rowKey);

    uniqueNormalizedTypeaheadTerms.add(normalizedQuery ?? '__unknown_norm__');

    if (!existing) {
      const rawQueryCounts = new Map<string, number>();
      if (rawQuery) {
        rawQueryCounts.set(rawQuery, 1);
      }

      typeaheadTermStats.set(rowKey, {
        normalizedQuery,
        count: 1,
        firstAt: typeaheadEvent.occurredAt,
        lastAt: typeaheadEvent.occurredAt,
        rawQueryCounts,
      });
    } else {
      existing.count += 1;
      if (typeaheadEvent.occurredAt < existing.firstAt) existing.firstAt = typeaheadEvent.occurredAt;
      if (typeaheadEvent.occurredAt > existing.lastAt) existing.lastAt = typeaheadEvent.occurredAt;
      if (rawQuery) {
        existing.rawQueryCounts.set(rawQuery, (existing.rawQueryCounts.get(rawQuery) ?? 0) + 1);
      }
    }

    const dayKey = getDayKey(typeaheadEvent.occurredAt);
    typeaheadByDay.set(dayKey, (typeaheadByDay.get(dayKey) ?? 0) + 1);

    const weekKey = getWeekKey(typeaheadEvent.occurredAt);
    typeaheadByWeek.set(weekKey, (typeaheadByWeek.get(weekKey) ?? 0) + 1);

    const dayOfWeek = typeaheadEvent.occurredAt.getUTCDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdayTypeaheadByDay.set(dayKey, (weekdayTypeaheadByDay.get(dayKey) ?? 0) + 1);
    }

    if (resultCount !== null) {
      typeaheadWithResultCount += 1;
      totalTypeaheadResultCount += resultCount;
      if (resultCount === 0) {
        typeaheadWithEmptyResults += 1;
      }
    }
  }

  const typeaheadRows = Array.from(typeaheadTermStats.entries())
    .map(([key, stats]) => {
      const activeDays = getInclusiveDaySpan(stats.firstAt, stats.lastAt);
      const activeWeeks = Math.max(1, Math.ceil(activeDays / 7));
      const clicks = typeaheadClicksByNormalizedQuery.get(stats.normalizedQuery?.toLowerCase() ?? '') ?? 0;
      const ctr = stats.count > 0 ? (clicks / stats.count) * 100 : 0;
      const atcs = atcsByNormalizedQuery.get(stats.normalizedQuery?.toLowerCase() ?? '') ?? 0;
      const atcRate = stats.count > 0 ? (atcs / stats.count) * 100 : 0;
      const rawQueryEntries = Array.from(stats.rawQueryCounts.entries()).sort((a, b) => b[1] - a[1]);
      const rawQuery = rawQueryEntries[0]?.[0] ?? null;

      return {
        key,
        rawQuery,
        normalizedQuery: stats.normalizedQuery,
        count: stats.count,
        clicks,
        ctr,
        atcs,
        atcRate,
        firstAt: stats.firstAt,
        lastAt: stats.lastAt,
        avgDaily: stats.count / activeDays,
        avgWeekly: stats.count / activeWeeks,
        distinctRawQueryCount: stats.rawQueryCounts.size,
        rawQueryVariants: rawQueryEntries.map(([value, count]) => ({ value, count })),
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return new Date(b.firstAt).getTime() - new Date(a.firstAt).getTime();
    });

  const totalTypeaheads = typeaheadEvents.length;
  const uniqueTypeaheadTerms = uniqueNormalizedTypeaheadTerms.size;
  const avgTypeaheadsDaily = typeaheadByDay.size ? totalTypeaheads / typeaheadByDay.size : 0;
  const avgTypeaheadsWeekly = typeaheadByWeek.size ? totalTypeaheads / typeaheadByWeek.size : 0;
  const weekdayAverageTypeaheads = weekdayTypeaheadByDay.size
    ? Array.from(weekdayTypeaheadByDay.values()).reduce((sum, count) => sum + count, 0) / weekdayTypeaheadByDay.size
    : 0;
  const averageItemsInTypeaheadResults = typeaheadWithResultCount ? totalTypeaheadResultCount / typeaheadWithResultCount : 0;
  const typeaheadEmptyResultsRate = typeaheadWithResultCount ? (typeaheadWithEmptyResults / typeaheadWithResultCount) * 100 : 0;
  const firstTypeaheadAt = totalTypeaheads ? typeaheadEvents[0].occurredAt : null;
  const lastTypeaheadAt = totalTypeaheads ? typeaheadEvents[typeaheadEvents.length - 1].occurredAt : null;
  const totalTypeaheadClicks = typeaheadClickEvents.length;
  const overallTypeaheadCtr = totalTypeaheads > 0 ? (totalTypeaheadClicks / totalTypeaheads) * 100 : 0;
  const totalTypeaheadAtcs = typeaheadRows.reduce((sum, r) => sum + r.atcs, 0);
  const overallTypeaheadAtcRate = totalTypeaheads > 0 ? (totalTypeaheadAtcs / totalTypeaheads) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{td('searches.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('searches.cards.weekdayAverage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekdayAverageSearches.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('searches.cards.dailyAverage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSearchesDaily.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('searches.cards.weeklyAverage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgSearchesWeekly.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('searches.cards.uniqueTerms')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueSearchTerms}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('searches.cards.emptyResults')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{searchesWithEmptyResults}</div>
            <p className="text-xs text-muted-foreground">{emptyResultsRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('searches.cards.avgResultItems')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageItemsInResults.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CTR General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallSearchCtr.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{totalSearchClicks} clicks / {totalSearches} búsquedas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ATC Rate General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallSearchAtcRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{totalSearchAtcs} ATCs / {totalSearches} búsquedas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{td('searches.table.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground">{td('searches.summary.totalSearches')}</p>
              <p className="text-lg font-semibold">{totalSearches}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{td('searches.summary.firstSearch')}</p>
              <p className="text-lg font-semibold">{firstSearchAt ? formatDateTime(firstSearchAt, locale, timeZone) : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{td('searches.summary.lastSearch')}</p>
              <p className="text-lg font-semibold">{lastSearchAt ? formatDateTime(lastSearchAt, locale, timeZone) : '—'}</p>
            </div>
          </div>

          <GroupedQueryTable
            rows={searchRows.map((row) => ({
              ...row,
              firstAtLabel: formatDateTime(row.firstAt, locale, timeZone),
              lastAtLabel: formatDateTime(row.lastAt, locale, timeZone),
            }))}
            unknownTermLabel={td('searches.unknownTerm')}
            emptyLabel={td('searches.empty')}
            detailsLabel={'Valores diferentes de Consulta original'}
            detailsListLabel={'Consultas originales'}
            headers={{
              rawQuery: td('searches.table.rawQuery'),
              normalizedQuery: td('searches.table.normalizedQuery'),
              count: td('searches.table.count'),
              clicks: td('searches.table.clicks'),
              ctr: td('searches.table.ctr'),
              atcs: 'ATCs',
              atcRate: 'ATC Rate',
              firstDatetime: td('searches.table.firstDatetime'),
              lastDatetime: td('searches.table.lastDatetime'),
              avgDaily: td('searches.table.avgDaily'),
              avgWeekly: td('searches.table.avgWeekly'),
            }}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">{td('typeaheads.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('typeaheads.cards.weekdayAverage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekdayAverageTypeaheads.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('typeaheads.cards.dailyAverage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgTypeaheadsDaily.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('typeaheads.cards.weeklyAverage')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgTypeaheadsWeekly.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('typeaheads.cards.uniqueTerms')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueTypeaheadTerms}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('typeaheads.cards.emptyResults')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typeaheadWithEmptyResults}</div>
            <p className="text-xs text-muted-foreground">{typeaheadEmptyResultsRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{td('typeaheads.cards.avgResultItems')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageItemsInTypeaheadResults.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CTR General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallTypeaheadCtr.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{totalTypeaheadClicks} clicks / {totalTypeaheads} typeaheads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ATC Rate General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallTypeaheadAtcRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{totalTypeaheadAtcs} ATCs / {totalTypeaheads} typeaheads</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{td('typeaheads.table.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 text-sm md:grid-cols-3">
            <div>
              <p className="text-muted-foreground">{td('typeaheads.summary.totalTypeaheads')}</p>
              <p className="text-lg font-semibold">{totalTypeaheads}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{td('typeaheads.summary.firstTypeahead')}</p>
              <p className="text-lg font-semibold">{firstTypeaheadAt ? formatDateTime(firstTypeaheadAt, locale, timeZone) : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{td('typeaheads.summary.lastTypeahead')}</p>
              <p className="text-lg font-semibold">{lastTypeaheadAt ? formatDateTime(lastTypeaheadAt, locale, timeZone) : '—'}</p>
            </div>
          </div>

          <GroupedQueryTable
            rows={typeaheadRows.map((row) => ({
              ...row,
              firstAtLabel: formatDateTime(row.firstAt, locale, timeZone),
              lastAtLabel: formatDateTime(row.lastAt, locale, timeZone),
            }))}
            unknownTermLabel={td('typeaheads.unknownTerm')}
            emptyLabel={td('typeaheads.empty')}
            detailsLabel={'Valores diferentes de Consulta original'}
            detailsListLabel={'Consultas originales'}
            headers={{
              rawQuery: td('typeaheads.table.rawQuery'),
              normalizedQuery: td('typeaheads.table.normalizedQuery'),
              count: td('typeaheads.table.count'),
              clicks: td('typeaheads.table.clicks'),
              ctr: td('typeaheads.table.ctr'),
              atcs: 'ATCs',
              atcRate: 'ATC Rate',
              firstDatetime: td('typeaheads.table.firstDatetime'),
              lastDatetime: td('typeaheads.table.lastDatetime'),
              avgDaily: td('typeaheads.table.avgDaily'),
              avgWeekly: td('typeaheads.table.avgWeekly'),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
