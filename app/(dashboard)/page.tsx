import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, ShoppingCart, Users, PlusCircle, LineChart, Workflow } from 'lucide-react';
import Link from 'next/link';
import { prisma } from '@jssprz/ludo2go-database';
import { OrderStatus, EventType, DeviceType } from '@prisma/client';
import { getLocale, getTranslations } from 'next-intl/server';

const formatPrice = (price: number, locale: string) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(price)
}

const formatDateTime = (date: Date, locale: string) => {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

function getSearchTermFromProperties(properties: unknown): string | null {
  if (!properties || typeof properties !== 'object') return null;

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

  const candidates = [
    props.normalizedQuery,
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

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const normalized = candidate.trim().toLowerCase();
      if (normalized.length > 0) return normalized;
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

function getUtmSourceFromProperties(properties: unknown): string | null {
  if (!properties || typeof properties !== 'object') return null;

  const props = properties as {
    utm?: {
      first?: { source?: string | null };
      last?: { source?: string | null };
      source?: string | null;
    };
  };

  const source = props.utm?.last?.source ?? props.utm?.first?.source ?? props.utm?.source;
  if (!source || typeof source !== 'string') return null;

  const normalized = source.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export default async function AdminHomePage() {
  const t = await getTranslations('dashboard');
  const tp = await getTranslations('products');
  const td = await getTranslations('dashboardPage');
  const locale = await getLocale();
  
  // get totals
  let totalProducts = await prisma.product.count();
  let totalVairants = await prisma.productVariant.count();
  let totalGames = await prisma.gameDetails.count();
  let totalExpansions = await prisma.gameExpansionDetails.count();
  let totalAccessories = await prisma.accessoryDetails.count();
  let totalBundles = await prisma.bundleDetails.count();
  let totalCustomers = await prisma.customer.count();
  let totalAddresses = await prisma.address.count();
  let totalOrders = await prisma.order.count();
  let totalPendingOrders = (await prisma.order.findMany({ where: { status: OrderStatus.pending } })).length
  let totalProcessingOrders = (await prisma.order.findMany({ where: { status: OrderStatus.processing } })).length
  let totalShippedOrders = (await prisma.order.findMany({ where: { status: OrderStatus.shipped } })).length
  let totalDeliveredOrders = (await prisma.order.findMany({ where: { status: OrderStatus.delivered } })).length
  let totalCancelledOrders = (await prisma.order.findMany({ where: { status: OrderStatus.cancelled } })).length

  // get averages
  let variants = (await prisma.productVariant.findMany({ include: { prices: true }, where: { prices: { some: {} } } }))
  let avgVariantPrice = variants.length ? variants.map((v) => v.prices[0].amount).reduce((sum, value) => sum + value, 0) / variants.length : 0

  let orders = (await prisma.order.findMany({ include: { items: true } }))
  let avgOrderSize = orders.length ? orders.map((o) => o.items.length).reduce((sum, value) => sum + value, 0) / orders.length : 0
  let avgOrderSubtotal = orders.length ? orders.map((o) => o.subtotal).reduce((sum, value) => sum + value, 0) / orders.length : 0
  let avgOrderShipping = orders.length ? orders.map((o) => o.shipping).reduce((sum, value) => sum + value, 0) / orders.length : 0
  let avgOrderTotal = orders.length ? orders.map((o) => o.total).reduce((sum, value) => sum + value, 0) / orders.length : 0
  let avgCustomerSpent = totalCustomers ? orders.map((o) => o.total).reduce((sum, value) => sum + value, 0) / totalCustomers : 0

  // events
  let avgCustomerVisits = totalCustomers ? (await prisma.event.groupBy({ by: ['sessionId'], where: { customerId: { not: null }, }, _count: { _all: true, }, })).map((g) => g._count._all).reduce((sum, value) => sum + value, 0) / totalCustomers : 0
  let totalDesktopVisits = (await prisma.event.groupBy({ by: ["sessionId"], where: { deviceType: DeviceType.desktop } })).length
  let totalMobileVisits = (await prisma.event.groupBy({ by: ["sessionId"], where: { deviceType: DeviceType.mobile } })).length
  let totalOtherVisits = (await prisma.event.groupBy({ by: ["sessionId"], where: { deviceType: { notIn: [DeviceType.mobile, DeviceType.desktop] } } })).length
  let desktopPurchases = (await prisma.event.findMany({ where: { deviceType: DeviceType.desktop, eventType: EventType.purchase } })).length
  let mobilePurchases = (await prisma.event.findMany({ where: { deviceType: DeviceType.mobile, eventType: EventType.purchase } })).length
  let desktopAtoC = (await prisma.event.findMany({ where: { deviceType: DeviceType.desktop, eventType: EventType.add_to_cart } })).length
  let mobileAtoC = (await prisma.event.findMany({ where: { deviceType: DeviceType.mobile, eventType: EventType.add_to_cart } })).length
  let desktopSearches = (await prisma.event.findMany({ where: { deviceType: DeviceType.desktop, eventType: EventType.search_performed } })).length
  let mobileSearches = (await prisma.event.findMany({ where: { deviceType: DeviceType.mobile, eventType: EventType.search_performed } })).length
  let desktopProductImprs = (await prisma.event.findMany({ where: { deviceType: DeviceType.desktop, eventType: EventType.product_impression } })).length
  let mobileProductImprs = (await prisma.event.findMany({ where: { deviceType: DeviceType.mobile, eventType: EventType.product_impression } })).length
  let desktopConversion = totalDesktopVisits ? desktopPurchases / totalDesktopVisits : 0
  let mobileConversion = totalMobileVisits ? mobilePurchases / totalMobileVisits : 0
  let desktopAtoCsRate = totalDesktopVisits ? desktopAtoC / totalDesktopVisits : 0
  let mobileAtoCsRate = totalMobileVisits ? mobileAtoC / totalMobileVisits : 0
  let avgDesktopProductImprs = totalVairants ? desktopProductImprs / totalVairants : 0
  let avgMobileProductImprs = totalVairants ? mobileProductImprs / totalVairants : 0

  // UTM / Channel traffic (session-based, last-touch source across all events)
  const channelEvents = await prisma.event.findMany({
    select: { sessionId: true, occurredAt: true, properties: true },
    orderBy: { occurredAt: 'asc' },
  });

  const sessionChannel = new Map<string, string>();
  for (const event of channelEvents) {
    const source = getUtmSourceFromProperties(event.properties);
    if (source) {
      sessionChannel.set(event.sessionId, source);
    } else if (!sessionChannel.has(event.sessionId)) {
      sessionChannel.set(event.sessionId, 'direct');
    }
  }

  const channelCountMap = new Map<string, number>();
  for (const source of Array.from(sessionChannel.values())) {
    channelCountMap.set(source, (channelCountMap.get(source) ?? 0) + 1);
  }

  const topChannels = Array.from(channelCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([source, visits]) => ({ source, visits }));

  const channelCards = [0, 1, 2, 3, 4, 5].map((index) => topChannels[index] ?? null);

  // Search analytics
  const searchEvents = await prisma.event.findMany({
    where: { eventType: EventType.search_performed },
    select: { occurredAt: true, properties: true },
    orderBy: { occurredAt: 'asc' },
  });

  const searchTermStats = new Map<
    string,
    {
      count: number;
      firstAt: Date;
      lastAt: Date;
    }
  >();
  const searchByDay = new Map<string, number>();
  const searchByWeek = new Map<string, number>();
  const weekdaySearchByDay = new Map<string, number>();

  for (const searchEvent of searchEvents) {
    const term = getSearchTermFromProperties(searchEvent.properties) ?? '__unknown__';
    const existing = searchTermStats.get(term);

    if (!existing) {
      searchTermStats.set(term, {
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
  }

  const searchRows = Array.from(searchTermStats.entries())
    .map(([term, stats]) => {
      const activeDays = getInclusiveDaySpan(stats.firstAt, stats.lastAt);
      const activeWeeks = Math.max(1, Math.ceil(activeDays / 7));

      return {
        term,
        count: stats.count,
        firstAt: stats.firstAt,
        lastAt: stats.lastAt,
        avgDaily: stats.count / activeDays,
        avgWeekly: stats.count / activeWeeks,
      };
    })
    .sort((a, b) => b.count - a.count);

  const totalSearches = searchEvents.length;
  const uniqueSearchTerms = searchRows.length;
  const avgSearchesDaily = searchByDay.size ? totalSearches / searchByDay.size : 0;
  const avgSearchesWeekly = searchByWeek.size ? totalSearches / searchByWeek.size : 0;
  const weekdayAverageSearches = weekdaySearchByDay.size
    ? Array.from(weekdaySearchByDay.values()).reduce((sum, count) => sum + count, 0) / weekdaySearchByDay.size
    : 0;
  const firstSearchAt = totalSearches ? searchEvents[0].occurredAt : null;
  const lastSearchAt = totalSearches ? searchEvents[searchEvents.length - 1].occurredAt : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/products/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              {tp('addProduct')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Catalog */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('catalog.title')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-5'>
              <div>
                <div className="text-xl font-bold">{totalProducts}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.products')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalVairants}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.variants')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgVariantPrice, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.avgPrice')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalGames}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.games')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalExpansions}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.expansions')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalAccessories}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.accessories')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalBundles}</div>
                <p className="text-xs text-muted-foreground">
                  {td('catalog.bundles')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Week Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('orders.title')}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-5'>
              <div>
                <div className="text-xl font-bold">{totalOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.total')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(avgOrderSize * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.avgSize')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgOrderSubtotal, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.avgSubtotal')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgOrderShipping, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.avgShipping')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgOrderTotal, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.avgTotal')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalPendingOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.pending')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalProcessingOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.processing')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalShippedOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.shipped')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalDeliveredOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.delivered')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalCancelledOrders}</div>
                <p className="text-xs text-muted-foreground">
                  {td('orders.cancelled')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customers */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('customers.title')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-5'>
              <div>
                <div className="text-xl font-bold">{totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.total')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(avgCustomerVisits * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.avgVisits')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(totalOrders / totalCustomers * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.avgOrders')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{formatPrice(avgCustomerSpent, locale)}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.avgSpent')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{totalAddresses}</div>
                <p className="text-xs text-muted-foreground">
                  {td('customers.addresses')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Traffic & Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('mobileTraffic.title')}</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">{totalMobileVisits}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.visits')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(mobileConversion * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.conversion')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(mobileAtoCsRate * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.atoc')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{mobileSearches}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.searches')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{mobileProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.itemImpressions')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{avgMobileProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.avgItemImpressions')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Traffic & Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('desktopTraffic.title')}</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">{totalDesktopVisits}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.visits')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopConversion * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.conversion')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopAtoCsRate * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.atoc')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopSearches}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.searches')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.itemImpressions')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{avgDesktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.avgItemImpressions')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Other/Unknown Device Traffic & Rates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('otherTraffic.title')}</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-6'>
              <div>
                <div className="text-xl font-bold">{totalOtherVisits}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.visits')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopConversion * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.conversion')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{Math.round(desktopAtoCsRate * 10) / 10}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.atoc')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopSearches}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.searches')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{desktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.itemImpressions')}
                </p>
              </div>
              <div>
                <div className="text-xl font-bold">{avgDesktopProductImprs}</div>
                <p className="text-xs text-muted-foreground">
                  {td('traffic.avgItemImpressions')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Traffic per Channel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{td('utm.title')}</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 grid-cols-2 md:grid-cols-6'>
              {channelCards.map((channel, idx) => (
                <div key={idx}>
                  <div className="text-xl font-bold">{channel ? channel.visits : '—'}</div>
                  <p className="text-xs text-muted-foreground capitalize">
                    {channel ? channel.source : '—'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search analytics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{td('searches.title')}</h2>
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
                  <TableHead>{td('searches.table.search')}</TableHead>
                  <TableHead className="text-right">{td('searches.table.count')}</TableHead>
                  <TableHead>{td('searches.table.firstDatetime')}</TableHead>
                  <TableHead>{td('searches.table.lastDatetime')}</TableHead>
                  <TableHead className="text-right">{td('searches.table.avgDaily')}</TableHead>
                  <TableHead className="text-right">{td('searches.table.avgWeekly')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchRows.length > 0 ? (
                  searchRows.slice(0, 50).map((row) => (
                    <TableRow key={row.term}>
                      <TableCell>{row.term === '__unknown__' ? td('searches.unknownTerm') : row.term}</TableCell>
                      <TableCell className="text-right">{row.count}</TableCell>
                      <TableCell>{formatDateTime(row.firstAt, locale)}</TableCell>
                      <TableCell>{formatDateTime(row.lastAt, locale)}</TableCell>
                      <TableCell className="text-right">{row.avgDaily.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{row.avgWeekly.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {td('searches.empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Quick navigation */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Catalog */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.catalog.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.catalog.description')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/products">{td('quick.catalog.viewProducts')}</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/products?status=draft">{td('quick.catalog.draftProducts')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders & Customers */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.ordersCustomers.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.ordersCustomers.description')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.ordersCustomers.ordersComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.ordersCustomers.customersComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stock & Inventory */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.stockInventory.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.stockInventory.description')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.stockInventory.stockPerVariantComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.stockInventory.lowStockComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Prices, promotions, and coupons */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.pricingPromotions.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.pricingPromotions.description1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.pricingPromotions.description2')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.pricingPromotions.description3')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.pricingPromotions.description4')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.pricingPromotions.pricesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.pricingPromotions.promotionsComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.pricingPromotions.couponsComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.pricingPromotions.simpleRulesComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Shipping & Logistics */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.shippingLogistics.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.shippingLogistics.description1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.shippingLogistics.description2')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.shippingLogistics.description3')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.shippingLogistics.description4')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.shippingLogistics.shippingZonesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.shippingLogistics.ratesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.shippingLogistics.couriersComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Content & Pages (mini CMS) */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.contentPages.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.contentPages.description1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.contentPages.description2')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.contentPages.pagesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.contentPages.bannersComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports & basic analytics */}
        <Card>
          <CardHeader>
            <CardTitle>{td('quick.reportsAnalytics.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {td('quick.reportsAnalytics.description1')}
            </p>
            <p className="text-sm text-muted-foreground">
              {td('quick.reportsAnalytics.description2')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled>
                {td('quick.reportsAnalytics.salesComingSoon')}
              </Button>
              <Button variant="outline" size="sm" disabled>
                {td('quick.reportsAnalytics.topProductsComingSoon')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}