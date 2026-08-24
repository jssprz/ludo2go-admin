import { prisma } from '@jssprz/ludo2go-database';
import Link from 'next/link';
import { AlertTriangle, GitCompareArrows, TrendingUp } from 'lucide-react';
import { InventoryTable } from './inventory-table';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Inventario' };

export default async function InventoryPage() {
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

      <InventoryTable variants={variants} locations={locations} />
    </div>
  );
}

