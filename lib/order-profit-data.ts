import { prisma } from '@jssprz/ludo2go-database';
import {
  calculateOrderProfit,
  type OrderProfitItem,
} from './order-profit';

type OrderForProfit = {
  id: string;
  status: string;
  createdAt: Date;
  currency: string;
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
): Promise<Map<string, { total: number | null; lines: Map<string, number | null> }>> {
  const variantIds = Array.from(new Set(orders.flatMap((order) => order.items.map((item) => item.variantId))));
  const latestOrderDate = orders.reduce(
    (latest, order) => order.createdAt > latest ? order.createdAt : latest,
    new Date(0)
  );

  if (variantIds.length === 0) {
    return new Map(orders.map((order) => [order.id, {
      total: 0,
      lines: new Map(order.items.map((item) => [item.id, 0])),
    }]));
  }

  const [costPrices, purchaseItems] = await Promise.all([
    prisma.costPrice.findMany({
      where: {
        variantId: { in: variantIds },
        isActive: true,
        effectiveFrom: { lte: latestOrderDate },
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
        quantityReceived: { gt: 0 },
        purchaseOrder: {
          status: 'received',
          receivedAt: { not: null, lte: latestOrderDate },
        },
      },
      orderBy: { purchaseOrder: { receivedAt: 'desc' } },
      select: {
        variantId: true,
        quantity: true,
        unitCost: true,
        discount: true,
        purchaseOrder: {
          select: {
            receivedAt: true,
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
        items,
      },
      costPrices,
      purchaseItems
    );
    return [order.id, {
      total: profit.total,
      lines: new Map(profit.lines.map((line) => [line.itemId, line.amount])),
    }];
  }));
}
