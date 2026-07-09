import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prisma } from '@jssprz/ludo2go-database';
import { EventType } from '@prisma/client';
import { getLocale, getTranslations } from 'next-intl/server';

const formatDateTime = (date: Date, locale: string) => {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
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

  const searchEvents = await prisma.event.findMany({
    where: { eventType: EventType.search_performed },
    select: { occurredAt: true, properties: true },
    orderBy: { occurredAt: 'asc' },
  });

  const searchTermStats = new Map<
    string,
    {
      rawQuery: string | null;
      normalizedQuery: string | null;
      count: number;
      firstAt: Date;
      lastAt: Date;
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
    const rowKey = `${normalizedQuery ?? '__unknown_norm__'}::${rawQuery ?? '__unknown_raw__'}`;
    const existing = searchTermStats.get(rowKey);

    uniqueNormalizedTerms.add(normalizedQuery ?? '__unknown_norm__');

    if (!existing) {
      searchTermStats.set(rowKey, {
        rawQuery,
        normalizedQuery,
        count: 1,
        firstAt: searchEvent.occurredAt,
        lastAt: searchEvent.occurredAt,
      });
    } else {
      existing.count += 1;
      if (searchEvent.occurredAt < existing.firstAt) existing.firstAt = searchEvent.occurredAt;
      if (searchEvent.occurredAt > existing.lastAt) existing.lastAt = searchEvent.occurredAt;
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

      return {
        key,
        rawQuery: stats.rawQuery,
        normalizedQuery: stats.normalizedQuery,
        count: stats.count,
        firstAt: stats.firstAt,
        lastAt: stats.lastAt,
        avgDaily: stats.count / activeDays,
        avgWeekly: stats.count / activeWeeks,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{td('searches.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
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
              <p className="text-lg font-semibold">{firstSearchAt ? formatDateTime(firstSearchAt, locale) : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{td('searches.summary.lastSearch')}</p>
              <p className="text-lg font-semibold">{lastSearchAt ? formatDateTime(lastSearchAt, locale) : '—'}</p>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{td('searches.table.rawQuery')}</TableHead>
                <TableHead>{td('searches.table.normalizedQuery')}</TableHead>
                <TableHead className="text-right">{td('searches.table.count')}</TableHead>
                <TableHead>{td('searches.table.firstDatetime')}</TableHead>
                <TableHead>{td('searches.table.lastDatetime')}</TableHead>
                <TableHead className="text-right">{td('searches.table.avgDaily')}</TableHead>
                <TableHead className="text-right">{td('searches.table.avgWeekly')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {searchRows.length > 0 ? (
                searchRows.slice(0, 100).map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.rawQuery ?? td('searches.unknownTerm')}</TableCell>
                    <TableCell>{row.normalizedQuery ?? td('searches.unknownTerm')}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell>{formatDateTime(row.firstAt, locale)}</TableCell>
                    <TableCell>{formatDateTime(row.lastAt, locale)}</TableCell>
                    <TableCell className="text-right">{row.avgDaily.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{row.avgWeekly.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {td('searches.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
