import { inferPurchaseOrderTaxOptions } from './purchase-order-tax';

export type OrderProfitItem = {
  id: string;
  variantId: string;
  quantity: number;
  cancelledQuantity: number;
  unitPrice: number;
  currency: string;
  isGift: boolean;
};

export type OrderProfitCostPrice = {
  variantId: string;
  amount: number;
  currency: string;
  taxIncluded: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type OrderProfitPurchaseItem = {
  variantId: string;
  unitCost: number;
  quantity: number;
  discount: number;
  purchaseOrder: {
    receivedAt: Date | null;
    currency: string;
    subtotal: number;
    tax: number;
    shipping: number;
    items: Array<{ discount: number }>;
  };
};

export type OrderProfitLine = {
  itemId: string;
  amount: number | null;
};

function costPriceIncludingTax(costPrice: OrderProfitCostPrice): number {
  return costPrice.taxIncluded ? costPrice.amount : Math.round(costPrice.amount * 1.19);
}

function purchaseCostIncludingTax(purchase: OrderProfitPurchaseItem): number {
  const discountPerUnit = purchase.discount / Math.max(1, purchase.quantity);
  const discountAfterTax = inferPurchaseOrderTaxOptions(purchase.purchaseOrder).discountAfterTax;
  return Math.round(
    discountAfterTax
      ? purchase.unitCost * 1.19 - discountPerUnit
      : (purchase.unitCost - discountPerUnit) * 1.19
  );
}

export function calculateOrderProfit(
  order: {
    createdAt: Date;
    status: string;
    currency: string;
    items: OrderProfitItem[];
  },
  costPrices: OrderProfitCostPrice[],
  purchaseItems: OrderProfitPurchaseItem[]
): { total: number | null; lines: OrderProfitLine[] } {
  const costsByVariant = new Map<string, OrderProfitCostPrice[]>();
  for (const costPrice of costPrices) {
    const costs = costsByVariant.get(costPrice.variantId) ?? [];
    costs.push(costPrice);
    costsByVariant.set(costPrice.variantId, costs);
  }

  const purchasesByVariant = new Map<string, OrderProfitPurchaseItem[]>();
  for (const purchase of purchaseItems) {
    const purchases = purchasesByVariant.get(purchase.variantId) ?? [];
    purchases.push(purchase);
    purchasesByVariant.set(purchase.variantId, purchases);
  }

  const lines = order.items.map((item) => {
    const remainingQuantity = Math.max(0, item.quantity - item.cancelledQuantity);
    if (order.status === 'cancelled' || remainingQuantity === 0) {
      return { itemId: item.id, amount: 0 };
    }
    if (item.currency !== order.currency) {
      return { itemId: item.id, amount: null };
    }

    const matchingPurchases = (purchasesByVariant.get(item.variantId) ?? [])
      .filter((purchase) =>
        purchase.purchaseOrder.receivedAt !== null
        && purchase.purchaseOrder.receivedAt <= order.createdAt
        && purchase.purchaseOrder.currency === item.currency
      )
      .sort((a, b) =>
        (b.purchaseOrder.receivedAt?.getTime() ?? 0) - (a.purchaseOrder.receivedAt?.getTime() ?? 0)
      );
    const latestPurchase = matchingPurchases[0];

    const matchingCostPrices = (costsByVariant.get(item.variantId) ?? [])
      .filter((costPrice) =>
        costPrice.currency === item.currency
        && costPrice.effectiveFrom <= order.createdAt
        && (costPrice.effectiveTo === null || costPrice.effectiveTo > order.createdAt)
      )
      .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
    const selectedCostPrice = matchingCostPrices[matchingCostPrices.length - 1];

    const unitCost = latestPurchase
      ? purchaseCostIncludingTax(latestPurchase)
      : selectedCostPrice
        ? costPriceIncludingTax(selectedCostPrice)
        : null;
    if (unitCost === null) return { itemId: item.id, amount: null };

    const soldUnitPrice = item.isGift ? 0 : item.unitPrice;
    return {
      itemId: item.id,
      amount: (soldUnitPrice - unitCost) * remainingQuantity,
    };
  });

  return {
    total: lines.every((line) => line.amount !== null)
      ? lines.reduce((sum, line) => sum + (line.amount ?? 0), 0)
      : null,
    lines,
  };
}
