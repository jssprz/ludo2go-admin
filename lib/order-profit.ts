import { inferPurchaseOrderTaxOptions } from './purchase-order-tax';
import { totalPaymentCommission, type CommissionPayment } from './payment-commissions';

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
    createdAt: Date;
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
  cost: number | null;
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
    total: number;
    shipping: number;
    payments: CommissionPayment[];
    items: OrderProfitItem[];
  },
  costPrices: OrderProfitCostPrice[],
  purchaseItems: OrderProfitPurchaseItem[]
): { total: number | null; cost: number | null; commission: number; lines: OrderProfitLine[] } {
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
      return { itemId: item.id, amount: 0, cost: 0 };
    }
    if (item.currency !== order.currency) {
      return { itemId: item.id, amount: null, cost: null };
    }

    // Same source as the Inventory page: latest purchase line (any non-draft PO).
    // Prefer purchases made on or before the order; otherwise use the latest one.
    const purchases = (purchasesByVariant.get(item.variantId) ?? [])
      .filter((purchase) => purchase.purchaseOrder.currency === item.currency)
      .sort((a, b) => b.purchaseOrder.createdAt.getTime() - a.purchaseOrder.createdAt.getTime());
    const latestPurchase = purchases.find((purchase) => purchase.purchaseOrder.createdAt <= order.createdAt)
      ?? purchases[0];

    const sameCurrencyCosts = (costsByVariant.get(item.variantId) ?? [])
      .filter((costPrice) => costPrice.currency === item.currency);
    const effectiveCosts = sameCurrencyCosts.filter((costPrice) =>
      costPrice.effectiveFrom <= order.createdAt
      && (costPrice.effectiveTo === null || costPrice.effectiveTo > order.createdAt)
    );
    const selectedCostPrice = (effectiveCosts.length ? effectiveCosts : sameCurrencyCosts)
      .sort((a, b) => costPriceIncludingTax(a) - costPriceIncludingTax(b))[0];

    const unitCost = latestPurchase
      ? purchaseCostIncludingTax(latestPurchase)
      : selectedCostPrice
        ? costPriceIncludingTax(selectedCostPrice)
        : null;
    if (unitCost === null) return { itemId: item.id, amount: null, cost: null };

    const soldUnitPrice = item.isGift ? 0 : item.unitPrice;
    return {
      itemId: item.id,
      amount: (soldUnitPrice - unitCost) * remainingQuantity,
      cost: unitCost * remainingQuantity,
    };
  });

  // Gain = amount charged excluding shipping (order total, so order-level discounts apply) minus item costs and payment commissions.
  const commission = order.status === 'cancelled' ? 0 : totalPaymentCommission(order.payments);
  const totalCost = lines.every((line) => line.cost !== null)
    ? lines.reduce((sum, line) => sum + (line.cost ?? 0), 0)
    : null;
  return {
    total: order.status === 'cancelled'
      ? 0
      : totalCost === null
        ? null
        : order.total - order.shipping - totalCost - commission,
    cost: order.status === 'cancelled' ? 0 : totalCost,
    commission,
    lines,
  };
}
