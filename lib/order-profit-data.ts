import { prisma } from '@jssprz/ludo2go-database';
import { resolveCommissionPayments, type CommissionPayment } from './payment-commissions';
import {
  calculateOrderProfit,
  type OrderProfitItem,
} from './order-profit';

type OrderForProfit = {
  id: string;
  status: string;
  createdAt: Date;
  currency: string;
  total: number;
  shipping: number;
  notes?: string | null;
  payments: Array<{ method: string; amount: number; status: string }>;
  items: Array<{
    id: string;
    variantId: string;
    quantity: number;
    unitPrice: number;
    currency: string;
    isGift: boolean;
    cancellations: Array<{ quantity: number }>;
  }>;
};

export async function getOrderProfits(
  orders: OrderForProfit[]
): Promise<Map<string, { total: number | null; cost: number | null; commission: number | null; payments: CommissionPayment[]; lines: Map<string, number | null> }>> {
  const variantIds = Array.from(new Set(orders.flatMap((order) => order.items.map((item) => item.variantId))));

  if (orders.length === 0) return new Map();

  const [costPrices, purchaseItems] = await Promise.all([
    prisma.costPrice.findMany({
      where: {
        variantId: { in: variantIds },
        isActive: true,
        supplier: { isActive: true },
      },
      select: {
        variantId: true,
        amount: true,
        currency: true,
        taxIncluded: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    }),
    prisma.purchaseOrderItem.findMany({
      where: {
        variantId: { in: variantIds },
        purchaseOrder: {
          status: { in: ['submitted', 'confirmed', 'partially_received', 'received'] },
        },
      },
      orderBy: { purchaseOrder: { createdAt: 'desc' } },
      select: {
        variantId: true,
        quantity: true,
        unitCost: true,
        discount: true,
        purchaseOrder: {
          select: {
            createdAt: true,
            currency: true,
            subtotal: true,
            tax: true,
            shipping: true,
            items: { select: { discount: true } },
          },
        },
      },
    }),
  ]);

  return new Map(orders.map((order) => {
    const payments = resolveCommissionPayments(order);
    const items: OrderProfitItem[] = order.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      cancelledQuantity: item.cancellations.reduce((sum, cancellation) => sum + cancellation.quantity, 0),
      unitPrice: item.unitPrice,
      currency: item.currency,
      isGift: item.isGift,
    }));
    const profit = calculateOrderProfit(
      {
        createdAt: order.createdAt,
        status: order.status,
        currency: order.currency,
        total: order.total,
        shipping: order.shipping,
        payments,
        items,
      },
      costPrices,
      purchaseItems
    );
    return [order.id, {
      total: profit.total,
      cost: profit.cost,
      commission: profit.commission,
      payments,
      lines: new Map(profit.lines.map((line) => [line.itemId, line.amount])),
    }];
  }));
}
