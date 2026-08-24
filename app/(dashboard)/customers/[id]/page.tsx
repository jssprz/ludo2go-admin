import { prisma } from '@jssprz/ludo2go-database';
import { notFound } from 'next/navigation';
import { Customer360 } from './customer-360';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.customer.findUnique({
    where: { id },
    select: { firstName: true, lastName: true, email: true },
  });
  if (!c) return { title: 'Cliente' };
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
  return { title: name };
}

// ─── Metric helpers ──────────────────────────────────────────────────────────

type Order = {
  id: string;
  status: string;
  total: number;
  currency: string;
  createdAt: Date;
  items: Array<{
    quantity: number;
    unitPrice: number;
    variant: { sku: string; product: { name: string } };
  }>;
};

function computeMetrics(orders: Order[]) {
  const completed = orders.filter((o) =>
    ['delivered', 'shipped', 'processing', 'confirmed'].includes(o.status),
  );

  const ltv = completed.reduce((s, o) => s + o.total, 0);
  const orderCount = completed.length;
  const aov = orderCount > 0 ? Math.round(ltv / orderCount) : 0;

  const sorted = [...completed].sort((a, b) => +a.createdAt - +b.createdAt);
  let avgDaysBetween: number | null = null;
  if (sorted.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = (+sorted[i].createdAt - +sorted[i - 1].createdAt) / 86_400_000;
      gaps.push(diff);
    }
    avgDaysBetween = Math.round(gaps.reduce((s, d) => s + d, 0) / gaps.length);
  }

  const lastOrder = sorted[sorted.length - 1] ?? null;
  const firstOrder = sorted[0] ?? null;
  const daysSinceLast = lastOrder
    ? Math.round((Date.now() - +lastOrder.createdAt) / 86_400_000)
    : null;

  return { ltv, orderCount, aov, avgDaysBetween, lastOrder, firstOrder, daysSinceLast };
}

// ─── RFM segment ─────────────────────────────────────────────────────────────

type ChurnRisk = 'low' | 'medium' | 'high';
type Segment =
  | 'champion'
  | 'loyal'
  | 'potential'
  | 'new'
  | 'at_risk'
  | 'hibernating'
  | 'inactive'
  | 'unknown';

const SEGMENT_LABELS: Record<Segment, { label: string; color: string }> = {
  champion:    { label: 'Campeón',          color: 'bg-emerald-100 text-emerald-800' },
  loyal:       { label: 'Leal',             color: 'bg-blue-100 text-blue-800' },
  potential:   { label: 'Potencial',        color: 'bg-indigo-100 text-indigo-800' },
  new:         { label: 'Nuevo',            color: 'bg-violet-100 text-violet-800' },
  at_risk:     { label: 'En riesgo',        color: 'bg-amber-100 text-amber-800' },
  hibernating: { label: 'Hibernando',       color: 'bg-orange-100 text-orange-800' },
  inactive:    { label: 'Inactivo',         color: 'bg-red-100 text-red-800' },
  unknown:     { label: 'Sin compras',      color: 'bg-gray-100 text-gray-600' },
};

function computeSegment(
  orderCount: number,
  daysSinceLast: number | null,
  avgDaysBetween: number | null,
): Segment {
  if (orderCount === 0 || daysSinceLast === null) return 'unknown';
  if (orderCount === 1 && daysSinceLast <= 30) return 'new';
  if (daysSinceLast > 300) return 'inactive';
  if (daysSinceLast > 120) return 'hibernating';
  if (orderCount >= 5 && daysSinceLast <= 60) return 'champion';
  if (orderCount >= 3 && daysSinceLast <= 90) return 'loyal';
  if (orderCount >= 2 && daysSinceLast <= 60) return 'potential';
  // Was buying regularly but hasn't recently
  if (avgDaysBetween !== null && daysSinceLast > avgDaysBetween * 2.5) return 'at_risk';
  return 'potential';
}

function computeChurnRisk(
  orderCount: number,
  daysSinceLast: number | null,
  avgDaysBetween: number | null,
): ChurnRisk {
  if (orderCount === 0 || daysSinceLast === null) return 'low';
  if (daysSinceLast > 300) return 'high';
  if (daysSinceLast > 150) return 'high';
  if (daysSinceLast > 90) return 'medium';
  if (avgDaysBetween !== null && daysSinceLast > avgDaysBetween * 2) return 'medium';
  return 'low';
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function Customer360Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        where: { status: { not: 'cancelled' } },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              variant: { select: { sku: true, product: { select: { name: true } } } },
            },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          variant: { select: { sku: true, product: { select: { name: true } } } },
        },
      },
      addresses: true,
      events: {
        orderBy: { occurredAt: 'desc' },
        take: 300,
        select: { eventType: true, occurredAt: true, pagePath: true },
      },
      carts: {
        where: { status: 'active' },
        take: 1,
        include: {
          items: { select: { quantity: true, unitPrice: true, currency: true } },
        },
      },
      wishlist: { include: { _count: { select: { items: true } } } },
    },
  });

  if (!customer) notFound();

  const orders = customer.orders as Order[];
  const { ltv, orderCount, aov, avgDaysBetween, lastOrder, firstOrder, daysSinceLast } =
    computeMetrics(orders);

  const segment = computeSegment(orderCount, daysSinceLast, avgDaysBetween);
  const churnRisk = computeChurnRisk(orderCount, daysSinceLast, avgDaysBetween);
  const segmentMeta = SEGMENT_LABELS[segment];

  // Event aggregates
  const eventCounts: Record<string, number> = {};
  for (const ev of customer.events) {
    eventCounts[ev.eventType] = (eventCounts[ev.eventType] ?? 0) + 1;
  }

  const activeCart = customer.carts[0] ?? null;
  const cartTotal = activeCart
    ? activeCart.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    : 0;
  const cartItemCount = activeCart
    ? activeCart.items.reduce((s, i) => s + i.quantity, 0)
    : 0;

  // Serialize dates → strings for client component
  const serialized = {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    username: customer.username,
    phone: customer.phone,
    avatar: customer.avatar,
    newsletter: customer.newsletter,
    notifications: customer.notifications,
    preferredLanguage: customer.preferredLanguage,
    preferredCurrency: customer.preferredCurrency,
    favoriteGameCategories: customer.favoriteGameCategories,
    createdAt: customer.createdAt.toISOString(),
    addresses: customer.addresses,
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      items: o.items.map((i) => ({
        sku: i.variant.sku,
        name: i.variant.product.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    })),
    reviews: customer.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      productName: r.variant.product.name,
      sku: r.variant.sku,
    })),
    recentEvents: customer.events.slice(0, 50).map((e) => ({
      eventType: e.eventType,
      occurredAt: e.occurredAt.toISOString(),
      pagePath: e.pagePath,
    })),
    eventCounts,
    wishlistCount: customer.wishlist?._count.items ?? 0,
    cartTotal,
    cartItemCount,
    cartCurrency: activeCart?.items[0]?.currency ?? 'CLP',
  };

  return (
    <Customer360
      customer={serialized}
      metrics={{ ltv, orderCount, aov, avgDaysBetween, daysSinceLast }}
      firstOrderDate={firstOrder?.createdAt?.toISOString() ?? null}
      lastOrderDate={lastOrder?.createdAt?.toISOString() ?? null}
      segment={segment}
      segmentLabel={segmentMeta.label}
      segmentColor={segmentMeta.color}
      churnRisk={churnRisk}
    />
  );
}
