import { prisma } from '@jssprz/ludo2go-database';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { computeCustomerProfileMetrics } from '@/lib/customer-profile-metrics';
import { profileEventReference } from '@/lib/customer-profile-events';
import { Customer360 } from './customer-360';

type Context = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Context) {
  const translate = await getTranslations('CustomerProfile');
  const fallback = translate('title');
  const session = await auth();
  if (
    !session?.user?.id ||
    !(await prisma.adminUser.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    }))
  )
    return { title: fallback };
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { firstName: true, lastName: true }
  });
  return {
    title: customer
      ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
        fallback
      : fallback
  };
}

function propertyString(properties: unknown, key: string): string | null {
  if (
    !properties ||
    typeof properties !== 'object' ||
    Array.isArray(properties)
  )
    return null;
  const value = (properties as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

export default async function Customer360Page({ params }: Context) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (
    !(await prisma.adminUser.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    }))
  )
    redirect('/login');
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          payments: { select: { status: true, amount: true, currency: true } },
          items: {
            include: {
              variant: {
                select: { sku: true, product: { select: { name: true } } }
              }
            }
          }
        }
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          variant: {
            select: { sku: true, product: { select: { name: true } } }
          }
        }
      },
      addresses: true,
      events: {
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 300,
        select: {
          id: true,
          eventType: true,
          occurredAt: true,
          pagePath: true,
          sessionId: true,
          properties: true
        }
      },
      carts: {
        where: { status: 'active' },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        include: { items: { select: { quantity: true } } }
      },
      wishlist: { include: { _count: { select: { items: true } } } }
    }
  });
  if (!customer) notFound();

  const currencies = Array.from(
    new Set(customer.orders.map((order) => order.currency))
  ).sort();
  const currency = currencies.includes(customer.preferredCurrency ?? '')
    ? customer.preferredCurrency!
    : currencies.includes('CLP') || currencies.length === 0
      ? 'CLP'
      : currencies[0];
  const now = new Date();
  const metricsByCurrency = Object.fromEntries(
    Array.from(new Set([currency, ...currencies])).map((unit) => {
      const metrics = computeCustomerProfileMetrics(customer.orders, unit, now);
      return [
        unit,
        {
          ltv: metrics.ltv,
          aov: metrics.aov,
          orderCount: metrics.orderCount,
          avgDaysBetween: metrics.avgDaysBetween,
          daysSinceLast: metrics.daysSinceLast,
          firstOrderDate: metrics.firstOrder?.createdAt.toISOString() ?? null,
          lastOrderDate: metrics.lastOrder?.createdAt.toISOString() ?? null
        }
      ];
    })
  );

  const productIds = Array.from(
    new Set(
      customer.events
        .map((event) => propertyString(event.properties, 'productId'))
        .filter((value): value is string => Boolean(value))
    )
  );
  const variantIds = Array.from(
    new Set(
      customer.events
        .map((event) => propertyString(event.properties, 'variantId'))
        .filter((value): value is string => Boolean(value))
    )
  );
  const [products, variants] = await Promise.all([
    productIds.length
      ? prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true }
        })
      : [],
    variantIds.length
      ? prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, sku: true, product: { select: { name: true } } }
        })
      : []
  ]);
  const productNames = new Map(
    products.map((product) => [product.id, product.name])
  );
  const variantNames = new Map(
    variants.map((variant) => [
      variant.id,
      `${variant.product.name} (${variant.sku})`
    ])
  );
  const orderIds = new Set(customer.orders.map((order) => order.id));
  const activeCart = customer.carts[0];
  const serialized = {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    newsletter: customer.newsletter,
    preferredLanguage: customer.preferredLanguage,
    preferredCurrency: customer.preferredCurrency,
    favoriteGameCategories: customer.favoriteGameCategories,
    createdAt: customer.createdAt.toISOString(),
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      label: address.label,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      region: address.region,
      country: address.country
    })),
    orders: customer.orders.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0)
    })),
    reviews: customer.reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
      productName: review.variant.product.name,
      sku: review.variant.sku
    })),
    recentEvents: customer.events.map((event) => {
      const orderId = propertyString(event.properties, 'orderId');
      const name =
        variantNames.get(propertyString(event.properties, 'variantId') ?? '') ??
        productNames.get(propertyString(event.properties, 'productId') ?? '');
      const reference = name
        ? { kind: 'name', value: name }
        : orderId && orderIds.has(orderId)
          ? { kind: 'order', value: orderId }
          : profileEventReference(event.properties);
      return {
        id: event.id,
        eventType: event.eventType,
        occurredAt: event.occurredAt.toISOString(),
        pagePath: event.pagePath,
        sessionId: event.sessionId,
        reference
      };
    }),
    wishlistCount: customer.wishlist?._count.items ?? 0,
    cartItemCount:
      activeCart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  };
  return (
    <Customer360
      key={customer.id}
      customer={serialized}
      metricsByCurrency={metricsByCurrency}
      initialCurrency={currency}
    />
  );
}
