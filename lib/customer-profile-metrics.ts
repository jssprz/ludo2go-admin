export type ProfileOrder = {
  id: string;
  status: string;
  total: number;
  currency: string;
  createdAt: Date;
  payments?: Array<{ status: string; amount: number; currency: string }>;
};

export function netCompletedRevenue(order: ProfileOrder): number {
  if (order.status !== 'delivered') return 0;
  const refunded = (order.payments ?? [])
    .filter(
      (payment) =>
        payment.status === 'refunded' && payment.currency === order.currency
    )
    .reduce((sum, payment) => sum + Math.max(0, payment.amount), 0);
  return Math.max(0, order.total - refunded);
}

export function computeCustomerProfileMetrics(
  orders: ProfileOrder[],
  currency = 'CLP',
  now = new Date()
) {
  const completed = orders
    .filter(
      (order) => order.currency === currency && order.status === 'delivered'
    )
    .sort((first, second) => +first.createdAt - +second.createdAt);
  const ltv = completed.reduce(
    (sum, order) => sum + netCompletedRevenue(order),
    0
  );
  const orderCount = completed.length;
  const firstOrder = completed[0] ?? null;
  const lastOrder = completed[orderCount - 1] ?? null;
  const avgDaysBetween =
    orderCount >= 2
      ? (+lastOrder!.createdAt - +firstOrder!.createdAt) /
        86_400_000 /
        (orderCount - 1)
      : null;
  const daysSinceLast = lastOrder
    ? Math.max(0, Math.floor((+now - +lastOrder.createdAt) / 86_400_000))
    : null;
  return {
    ltv,
    orderCount,
    aov: orderCount ? ltv / orderCount : 0,
    avgDaysBetween,
    daysSinceLast,
    firstOrder,
    lastOrder,
    currency,
    currencies: Array.from(
      new Set(orders.map((order) => order.currency))
    ).sort()
  };
}

export type ProfileSegment =
  | 'champion'
  | 'loyal'
  | 'potential'
  | 'new'
  | 'at_risk'
  | 'hibernating'
  | 'inactive'
  | 'unknown';
export type ProfileChurnRisk = 'low' | 'medium' | 'high' | 'insufficient';

export function computeProfileSegment(
  orderCount: number,
  daysSinceLast: number | null,
  avgDaysBetween: number | null
): ProfileSegment {
  if (!orderCount || daysSinceLast === null) return 'unknown';
  if (orderCount === 1 && daysSinceLast <= 30) return 'new';
  if (daysSinceLast > 300) return 'inactive';
  if (daysSinceLast > 120) return 'hibernating';
  if (orderCount >= 5 && daysSinceLast <= 60) return 'champion';
  if (orderCount >= 3 && daysSinceLast <= 90) return 'loyal';
  if (
    avgDaysBetween !== null &&
    avgDaysBetween > 0 &&
    daysSinceLast > avgDaysBetween * 2.5
  )
    return 'at_risk';
  return 'potential';
}

export function computeProfileChurnRisk(
  orderCount: number,
  daysSinceLast: number | null,
  avgDaysBetween: number | null
): ProfileChurnRisk {
  if (
    orderCount < 3 ||
    daysSinceLast === null ||
    avgDaysBetween === null ||
    avgDaysBetween <= 0
  )
    return 'insufficient';
  if (daysSinceLast > 150) return 'high';
  if (daysSinceLast > 90 || daysSinceLast > avgDaysBetween * 2) return 'medium';
  return 'low';
}
