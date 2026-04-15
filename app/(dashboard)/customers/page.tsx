import { prisma } from '@jssprz/ludo2go-database';
import { CustomersTable } from './customers-table';

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

  const [customers, totalCustomers, gameCategories] = await Promise.all([
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
  ]);

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
      newsletter: c.newsletter ?? false,
      preferredLanguage: c.preferredLanguage,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">
          View all customers, their orders and activity.
        </p>
      </div>
      <CustomersTable
        customers={rows}
        totalCustomers={totalCustomers}
        offset={offset + customers.length}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
      />
    </div>
  );
}
