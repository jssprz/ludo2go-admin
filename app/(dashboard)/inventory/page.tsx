import { prisma } from '@jssprz/ludo2go-database';
import Link from 'next/link';
import { AlertTriangle, GitCompareArrows, TrendingUp } from 'lucide-react';
import { InventoryTable } from './inventory-table';
import { Button } from '@/components/ui/button';
import { StockTrendChart } from './stock-trend-chart';
import { PurchaseOrderStatus } from '@prisma/client';

export const metadata = { title: 'Inventario' };

export default async function InventoryPage() {
  const weeksToShow = 12;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
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

  // Quick stats for sub-nav badges
  const lowStockCount = await prisma.inventory.count({
    where: { onHand: { lte: 5 } },
  });

  const discrepancyOrderCount = await prisma.purchaseOrder.count({
    where: {
      status: { notIn: ['cancelled', 'received'] },
      items: { some: {} },
    },
  });

  const [stockAggregate, soldItems, receivedItems] = await Promise.all([
    prisma.inventory.aggregate({
      _sum: {
        onHand: true,
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: {
            gte: firstWeekStart,
          },
          status: {
            not: 'cancelled',
          },
        },
      },
      select: {
        quantity: true,
        order: {
          select: {
            createdAt: true,
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
  ]);

  const soldByWeek = Array.from({ length: weeksToShow }).map(() => 0);
  const receivedByWeek = Array.from({ length: weeksToShow }).map(() => 0);

  for (const item of soldItems) {
    const index = Math.floor((item.order.createdAt.getTime() - firstWeekStart.getTime()) / msPerWeek);
    if (index >= 0 && index < weeksToShow) {
      soldByWeek[index] += item.quantity;
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
            <Link href="/inventory/alerts" className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertas
              {lowStockCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                  {lowStockCount}
                </span>
              )}
            </Link>
          </Button>
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

      <InventoryTable variants={variants} locations={locations} />
    </div>
  );
}

