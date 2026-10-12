import { prisma } from '@jssprz/ludo2go-database';
import Link from 'next/link';
import { GitCompareArrows, TrendingUp } from 'lucide-react';
import { InventoryTable } from './inventory-table';
import { InventoryWorkspace } from './inventory-workspace';
import { Button } from '@/components/ui/button';
import { StockTrendChart } from './stock-trend-chart';
import { PurchaseOrderStatus } from '@prisma/client';

export const metadata = { title: 'Inventario' };

export default async function InventoryPage() {
  const weeksToShow = 12;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const yearStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const currentWeekStart = new Date(now);
  const day = currentWeekStart.getDay();
  const diffToMonday = (day + 6) % 7;
  currentWeekStart.setDate(currentWeekStart.getDate() - diffToMonday);
  currentWeekStart.setHours(0, 0, 0, 0);

  const firstWeekStart = new Date(currentWeekStart.getTime() - msPerWeek * (weeksToShow - 1));
  const weekStarts = Array.from({ length: weeksToShow }).map((_, index) =>
    new Date(firstWeekStart.getTime() + index * msPerWeek)
  );

  const [variants, locations] = await Promise.all([
    prisma.productVariant.findMany({
      include: {
        product: { select: { id: true, name: true, slug: true } },
        inventory: { include: { location: true } },
      },
      orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }],
    }),
    prisma.location.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const discrepancyOrderCount = await prisma.purchaseOrder.count({
    where: {
      status: { notIn: ['cancelled', 'received'] },
      items: { some: {} },
    },
  });

  const [stockAggregate, soldItems, receivedItems, costPrices, incomingItems, lastPurchaseItems] = await Promise.all([
    prisma.inventory.aggregate({
      _sum: {
        onHand: true,
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: {
            gte: yearStart,
          },
          status: {
            not: 'cancelled',
          },
        },
      },
      select: {
        variantId: true,
        quantity: true,
        unitPrice: true,
        order: {
          select: {
            createdAt: true,
            currency: true,
          },
        },
      },
    }),
    prisma.purchaseOrderItem.findMany({
      where: {
        quantityReceived: {
          gt: 0,
        },
        purchaseOrder: {
          receivedAt: {
            gte: firstWeekStart,
          },
          status: {
            in: [PurchaseOrderStatus.partially_received, PurchaseOrderStatus.received],
          },
        },
      },
      select: {
        quantityReceived: true,
        purchaseOrder: {
          select: {
            receivedAt: true,
          },
        },
      },
    }),
    prisma.costPrice.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        supplier: { isActive: true },
      },
      include: {
        supplier: { select: { id: true, name: true, leadTimeDays: true } },
      },
      orderBy: [{ amount: 'asc' }, { effectiveFrom: 'desc' }],
    }),
    prisma.purchaseOrderItem.findMany({
      where: {
        purchaseOrder: {
          status: {
            in: [
              PurchaseOrderStatus.submitted,
              PurchaseOrderStatus.confirmed,
              PurchaseOrderStatus.partially_received,
            ],
          },
        },
      },
      select: { variantId: true, quantity: true, quantityReceived: true },
    }),
    prisma.purchaseOrderItem.findMany({
      where: {
        purchaseOrder: {
          status: {
            in: [
              PurchaseOrderStatus.submitted,
              PurchaseOrderStatus.confirmed,
              PurchaseOrderStatus.partially_received,
              PurchaseOrderStatus.received,
            ],
          },
        },
      },
      orderBy: { purchaseOrder: { createdAt: 'desc' } },
      select: {
        variantId: true,
        unitCost: true,
        purchaseOrder: { select: { supplierId: true, currency: true, supplier: { select: { id: true, name: true, leadTimeDays: true } } } },
      },
    }),
  ]);

  const soldByWeek = Array.from({ length: weeksToShow }).map(() => 0);
  const receivedByWeek = Array.from({ length: weeksToShow }).map(() => 0);
  const weeklySalesByVariant = new Map<string, number[]>();
  const revenueByCurrency = new Map<string, Map<string, number>>();

  for (const item of soldItems) {
    const index = Math.floor((item.order.createdAt.getTime() - firstWeekStart.getTime()) / msPerWeek);
    if (index >= 0 && index < weeksToShow) {
      soldByWeek[index] += item.quantity;
    }

    if (index >= 0 && index < weeksToShow) {
      const weeklySales = weeklySalesByVariant.get(item.variantId) ?? Array.from({ length: weeksToShow }).map(() => 0);
      weeklySales[index] += item.quantity;
      weeklySalesByVariant.set(item.variantId, weeklySales);
    }

    if (item.order.currency === 'CLP') {
      const currencyRevenue = revenueByCurrency.get(item.order.currency) ?? new Map<string, number>();
      currencyRevenue.set(item.variantId, (currencyRevenue.get(item.variantId) ?? 0) + item.quantity * item.unitPrice);
      revenueByCurrency.set(item.order.currency, currencyRevenue);
    }
  }

  for (const item of receivedItems) {
    if (!item.purchaseOrder.receivedAt) {
      continue;
    }

    const index = Math.floor((item.purchaseOrder.receivedAt.getTime() - firstWeekStart.getTime()) / msPerWeek);
    if (index >= 0 && index < weeksToShow) {
      receivedByWeek[index] += item.quantityReceived;
    }
  }

  const currentTotalStock = stockAggregate._sum.onHand ?? 0;
  const netChanges = soldByWeek.map((sold, index) => receivedByWeek[index] - sold);
  const periodNetChange = netChanges.reduce((sum, value) => sum + value, 0);
  let runningTotal = currentTotalStock - periodNetChange;

  const labelFormatter = new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
  });

  const stockTrendPoints = weekStarts.map((weekStart, index) => {
    runningTotal += netChanges[index];

    return {
      label: labelFormatter.format(weekStart),
      totalStock: runningTotal,
      netMovement: netChanges[index],
      received: receivedByWeek[index],
      sold: soldByWeek[index],
    };
  });

  const abcGrades = new Map<string, 'A' | 'B' | 'C'>();
  for (const currencyRevenue of Array.from(revenueByCurrency.values())) {
    const rankedVariants = Array.from(currencyRevenue.entries()).sort((a, b) => b[1] - a[1]);
    const totalRevenue = rankedVariants.reduce((sum, [, revenue]) => sum + revenue, 0);
    let cumulativeRevenue = 0;
    for (const [variantId, revenue] of rankedVariants) {
      const shareBeforeCurrentItem = totalRevenue > 0 ? cumulativeRevenue / totalRevenue : 1;
      const grade = shareBeforeCurrentItem < 0.8 ? 'A' : shareBeforeCurrentItem < 0.95 ? 'B' : 'C';
      const currentGrade = abcGrades.get(variantId);
      if (!currentGrade || grade < currentGrade) abcGrades.set(variantId, grade);
      cumulativeRevenue += revenue;
    }
  }

  const costPriceByVariant = new Map<string, (typeof costPrices)[number]>();
  const costPriceBySupplierVariant = new Map<string, (typeof costPrices)[number]>();
  for (const costPrice of costPrices) {
    const supplierVariantKey = `${costPrice.variantId}:${costPrice.supplierId}`;
    if (!costPriceBySupplierVariant.has(supplierVariantKey)) {
      costPriceBySupplierVariant.set(supplierVariantKey, costPrice);
    }
    if (!costPriceByVariant.has(costPrice.variantId)) costPriceByVariant.set(costPrice.variantId, costPrice);
  }

  const latestPurchaseByVariant = new Map<string, (typeof lastPurchaseItems)[number]>();
  for (const purchaseItem of lastPurchaseItems) {
    if (!latestPurchaseByVariant.has(purchaseItem.variantId)) latestPurchaseByVariant.set(purchaseItem.variantId, purchaseItem);
  }

  const incomingByVariant = new Map<string, number>();
  for (const item of incomingItems) {
    incomingByVariant.set(item.variantId, (incomingByVariant.get(item.variantId) ?? 0) + Math.max(0, item.quantity - item.quantityReceived));
  }

  const recommendations = variants.map((variant) => {
    const lastPurchase = latestPurchaseByVariant.get(variant.id);
    const costPrice = lastPurchase
      ? costPriceBySupplierVariant.get(`${variant.id}:${lastPurchase.purchaseOrder.supplierId}`)
      : costPriceByVariant.get(variant.id);
    const supplier = lastPurchase?.purchaseOrder.supplier ?? costPrice?.supplier ?? null;
    const weeklySales = weeklySalesByVariant.get(variant.id) ?? Array.from({ length: weeksToShow }).map(() => 0);
    return {
      variantId: variant.id,
      productId: variant.product.id,
      productName: variant.product.name,
      sku: variant.sku,
      weeklySales,
      abcGrade: abcGrades.get(variant.id) ?? 'C',
      incoming: incomingByVariant.get(variant.id) ?? 0,
      leadTimeDays: supplier?.leadTimeDays ?? 14,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
      currency: costPrice?.currency ?? lastPurchase?.purchaseOrder.currency ?? 'CLP',
      unitCost: costPrice?.amount ?? lastPurchase?.unitCost ?? null,
      lastPurchaseCost: lastPurchase?.unitCost ?? null,
      moq: costPrice?.moq ?? 1,
      packSize: 1,
      locations: locations.map((location) => {
        const inventory = variant.inventory.find((entry) => entry.locationId === location.id);
        return {
          id: location.id,
          name: location.name,
          code: location.code,
          available: Math.max(0, (inventory?.onHand ?? 0) - (inventory?.reserved ?? 0)),
        };
      }),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Stock por variante y bodega
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/discrepancies" className="flex items-center gap-1.5">
              <GitCompareArrows className="h-4 w-4 text-indigo-500" />
              Discrepancias
              {discrepancyOrderCount > 0 && (
                <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
                  {discrepancyOrderCount}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/costs" className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Costos y Márgenes
            </Link>
          </Button>
        </div>
      </div>

      <StockTrendChart points={stockTrendPoints} />

      <InventoryWorkspace recommendations={recommendations} locations={locations}>
        <InventoryTable variants={variants} locations={locations} />
      </InventoryWorkspace>
    </div>
  );
}

