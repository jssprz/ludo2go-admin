import { prisma } from '@jssprz/ludo2go-database';
import { EventType } from '@prisma/client';
import { CustomersTable } from './customers-table';
import { CreateCustomerDialog } from './create-customer-dialog';

type EventCounts = Partial<Record<EventType, number>>;
type CountedValue = { value: string; count: number };

function isCartEventType(eventType: EventType): boolean {
  return eventType.includes('cart');
}

function getVisitorIdFromProperties(properties: unknown): string | null {
  if (!properties || typeof properties !== 'object') return null;

  const props = properties as { visitorId?: unknown };
  if (typeof props.visitorId !== 'string') return null;

  const normalized = props.visitorId.trim();
  return normalized.length > 0 ? normalized : null;
}

function getStringProperty(properties: unknown, keys: string[]): string | null {
  if (!properties || typeof properties !== 'object') return null;

  const props = properties as Record<string, unknown>;
  for (const key of keys) {
    const value = props[key];
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized.length > 0) return normalized;
  }

  return null;
}

function mapToSortedCountedValues(map: Map<string, number>): CountedValue[] {
  return Array.from(map.entries())
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

export default async function CustomersPage(
  props: {
    searchParams: Promise<{ q?: string; offset?: string; sort?: string; order?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const search = searchParams.q ?? '';
  const offset = Number(searchParams.offset ?? 0);
  const sortBy = searchParams.sort ?? 'createdAt';
  const sortOrder = (searchParams.order === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
  const take = 20;

  // Build where clause
  const where: any = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Build orderBy
  let orderBy: any;
  if (sortBy === 'orders') {
    orderBy = { orders: { _count: sortOrder } };
  } else if (['createdAt', 'email', 'firstName', 'lastName'].includes(sortBy)) {
    orderBy = { [sortBy]: sortOrder };
  } else {
    orderBy = { createdAt: 'desc' };
  }

  const [customers, totalCustomers, gameCategories, anonymousEvents] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        _count: {
          select: { orders: true, reviews: true },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, total: true, currency: true },
        },
        carts: {
          where: { status: 'active' },
          include: {
            items: {
              select: { quantity: true, unitPriceAtAdd: true },
            },
          },
          take: 1,
          orderBy: { updatedAt: 'desc' },
        },
        events: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: { occurredAt: true },
        },
      },
      orderBy,
      skip: offset,
      take,
    }),
    prisma.customer.count({ where }),
    prisma.gameCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
    prisma.event.findMany({
      where: {
        customerId: null,
      },
      select: {
        sessionId: true,
        occurredAt: true,
        eventType: true,
        pagePath: true,
        properties: true,
      },
      orderBy: { occurredAt: 'desc' },
    }),
  ]);

  const customerIds = customers.map((customer) => customer.id);
  const customerEvents = customerIds.length
    ? await prisma.event.findMany({
        where: {
          customerId: { in: customerIds },
        },
        select: {
          customerId: true,
          sessionId: true,
          eventType: true,
          pagePath: true,
        },
      })
    : [];

  const customerEventTypeTotals = new Map<EventType, number>();
  const anonymousEventTypeTotals = new Map<EventType, number>();
  const customerActivityMap = new Map<string, {
    visitsCount: number;
    itemsVisited: number;
    searchesPerformed: number;
    sessionIds: Set<string>;
    eventCounts: EventCounts;
  }>();
  for (const event of customerEvents) {
    if (!event.customerId) continue;
    const current = customerActivityMap.get(event.customerId) ?? {
      visitsCount: 0,
      itemsVisited: 0,
      searchesPerformed: 0,
      sessionIds: new Set<string>(),
      eventCounts: {},
    };

    current.sessionIds.add(event.sessionId);
    current.visitsCount = current.sessionIds.size;
    current.eventCounts[event.eventType] = (current.eventCounts[event.eventType] ?? 0) + 1;

    customerEventTypeTotals.set(event.eventType, (customerEventTypeTotals.get(event.eventType) ?? 0) + 1);

    if (event.eventType === EventType.product_view) current.itemsVisited += 1;
    if (event.eventType === EventType.search_performed) current.searchesPerformed += 1;
    customerActivityMap.set(event.customerId, current);
  }

  const anonymousVisitorsMap = new Map<string, {
    visitorId: string;
    firstVisitDate: string;
    lastVisitDate: string;
    visitsCount: number;
    sessionIds: Set<string>;
    pageViews: number;
    cartActivity: number;
    itemsVisited: number;
    searchesPerformed: number;
    eventCounts: EventCounts;
    pageViewCounts: Map<string, number>;
    itemVisitedCounts: Map<string, number>;
  }>();

  for (const event of anonymousEvents) {
    const visitorId = getVisitorIdFromProperties(event.properties);
    if (!visitorId) continue;

    const pagePath = event.eventType === EventType.page_view
      ? event.pagePath
      : null;
    const productLabel = event.eventType === EventType.product_view
      ? getStringProperty(event.properties, ['productSlug', 'productId'])
      : null;

    const existing = anonymousVisitorsMap.get(visitorId);
    const occurredAtIso = event.occurredAt.toISOString();

    if (!existing) {
      anonymousVisitorsMap.set(visitorId, {
        visitorId,
        firstVisitDate: occurredAtIso,
        lastVisitDate: occurredAtIso,
        visitsCount: 1,
        sessionIds: new Set([event.sessionId]),
        pageViews: event.eventType === EventType.page_view ? 1 : 0,
        cartActivity: isCartEventType(event.eventType) ? 1 : 0,
        itemsVisited: event.eventType === EventType.product_view ? 1 : 0,
        searchesPerformed: event.eventType === EventType.search_performed ? 1 : 0,
        eventCounts: { [event.eventType]: 1 },
        pageViewCounts: pagePath ? new Map([[pagePath, 1]]) : new Map(),
        itemVisitedCounts: productLabel ? new Map([[productLabel, 1]]) : new Map(),
      });

      anonymousEventTypeTotals.set(event.eventType, (anonymousEventTypeTotals.get(event.eventType) ?? 0) + 1);
      continue;
    }

    if (occurredAtIso < existing.firstVisitDate) existing.firstVisitDate = occurredAtIso;
    if (occurredAtIso > existing.lastVisitDate) existing.lastVisitDate = occurredAtIso;
    existing.sessionIds.add(event.sessionId);
    existing.visitsCount = existing.sessionIds.size;
    existing.eventCounts[event.eventType] = (existing.eventCounts[event.eventType] ?? 0) + 1;
    if (isCartEventType(event.eventType)) existing.cartActivity += 1;
    if (pagePath) existing.pageViewCounts.set(pagePath, (existing.pageViewCounts.get(pagePath) ?? 0) + 1);
    if (productLabel) existing.itemVisitedCounts.set(productLabel, (existing.itemVisitedCounts.get(productLabel) ?? 0) + 1);

    anonymousEventTypeTotals.set(event.eventType, (anonymousEventTypeTotals.get(event.eventType) ?? 0) + 1);

    if (event.eventType === EventType.page_view) existing.pageViews += 1;
    if (event.eventType === EventType.product_view) existing.itemsVisited += 1;
    if (event.eventType === EventType.search_performed) existing.searchesPerformed += 1;
  }

  const customerEventTypes = Array.from(customerEventTypeTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([eventType]) => eventType);

  const anonymousEventTypes = Array.from(anonymousEventTypeTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([eventType]) => eventType);

  const anonymousVisitors = Array.from(anonymousVisitorsMap.values())
    .map(({ sessionIds, pageViewCounts, itemVisitedCounts, ...visitor }) => ({
      ...visitor,
      pageViewsList: mapToSortedCountedValues(pageViewCounts),
      itemsVisitedList: mapToSortedCountedValues(itemVisitedCounts),
    }))
    .sort((a, b) => {
      return new Date(b.lastVisitDate).getTime() - new Date(a.lastVisitDate).getTime()
        || b.visitsCount - a.visitsCount
        || b.pageViews - a.pageViews
        || b.itemsVisited - a.itemsVisited
        || b.searchesPerformed - a.searchesPerformed;
    })
    .slice(0, 100);

  // Build a map from category id -> name
  const categoryMap = new Map(gameCategories.map((c) => [c.id, c.name]));

  // Transform the data for the table
  const rows = customers.map((c) => {
    const activeCart = c.carts[0];
    const cartTotal = activeCart
      ? activeCart.items.reduce(
          (sum, item) => sum + (item.unitPriceAtAdd ?? 0) * item.quantity,
          0
        )
      : 0;
    const cartItemCount = activeCart
      ? activeCart.items.reduce((sum, item) => sum + item.quantity, 0)
      : 0;

    const favCategories = (c.favoriteGameCategories ?? [])
      .map((id) => categoryMap.get(id))
      .filter(Boolean) as string[];

    return {
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      username: c.username,
      avatar: c.avatar,
      phone: c.phone,
      createdAt: c.createdAt.toISOString(),
      ordersCount: c._count.orders,
      reviewsCount: c._count.reviews,
      lastOrderDate: c.orders[0]?.createdAt?.toISOString() ?? null,
      lastOrderTotal: c.orders[0]?.total ?? null,
      lastOrderCurrency: c.orders[0]?.currency ?? null,
      cartTotal,
      cartItemCount,
      favoriteCategories: favCategories,
      lastVisitDate: c.events[0]?.occurredAt?.toISOString() ?? null,
      visitsCount: customerActivityMap.get(c.id)?.visitsCount ?? 0,
      itemsVisited: customerActivityMap.get(c.id)?.itemsVisited ?? 0,
      searchesPerformed: customerActivityMap.get(c.id)?.searchesPerformed ?? 0,
      eventCounts: customerActivityMap.get(c.id)?.eventCounts ?? {},
      newsletter: c.newsletter ?? false,
      preferredLanguage: c.preferredLanguage,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            View all customers, their orders and activity.
          </p>
        </div>
        <CreateCustomerDialog />
      </div>
      <CustomersTable
        customers={rows}
        anonymousVisitors={anonymousVisitors}
        totalCustomers={totalCustomers}
        offset={offset + customers.length}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        customerEventTypes={customerEventTypes}
        anonymousEventTypes={anonymousEventTypes}
      />
    </div>
  );
}
