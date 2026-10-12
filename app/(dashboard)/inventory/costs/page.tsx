import { prisma } from '@jssprz/ludo2go-database';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PurchaseOrderStatus } from '@prisma/client';

export const metadata = { title: 'Costos y Márgenes' };

function fmt(n: number, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(n);
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

export default async function CostsPage() {
  const now = new Date();
  const [costPrices, purchaseItems] = await Promise.all([
    prisma.costPrice.findMany({
      where: {
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        supplier: { isActive: true },
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            product: { select: { id: true, name: true } },
            prices: {
              where: { active: true, type: { in: ['retail', 'sale'] } },
              orderBy: [{ type: 'asc' }, { amount: 'desc' }],
              take: 1,
              select: { amount: true, type: true, currency: true },
            },
            inventory: { select: { onHand: true, reserved: true } },
          },
        },
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
              PurchaseOrderStatus.received,
            ],
          },
        },
      },
      orderBy: { purchaseOrder: { createdAt: 'desc' } },
      include: {
        purchaseOrder: {
          select: {
            supplierId: true,
            currency: true,
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
        variant: {
          select: {
            id: true,
            sku: true,
            product: { select: { id: true, name: true } },
            prices: {
              where: { active: true, type: { in: ['retail', 'sale'] } },
              orderBy: [{ type: 'asc' }, { amount: 'desc' }],
              take: 1,
              select: { amount: true, type: true, currency: true },
            },
            inventory: { select: { onHand: true, reserved: true } },
          },
        },
      },
    }),
  ]);

  const costPriceByVariantSupplier = new Map<string, (typeof costPrices)[number]>();
  const cheapestCostPriceByVariant = new Map<string, (typeof costPrices)[number]>();
  for (const costPrice of costPrices) {
    const key = `${costPrice.variantId}:${costPrice.supplierId}`;
    if (!costPriceByVariantSupplier.has(key)) costPriceByVariantSupplier.set(key, costPrice);
    if (!cheapestCostPriceByVariant.has(costPrice.variantId)) {
      cheapestCostPriceByVariant.set(costPrice.variantId, costPrice);
    }
  }

  const latestPurchaseByVariant = new Map<string, (typeof purchaseItems)[number]>();
  for (const purchaseItem of purchaseItems) {
    if (!latestPurchaseByVariant.has(purchaseItem.variantId)) {
      latestPurchaseByVariant.set(purchaseItem.variantId, purchaseItem);
    }
  }

  // Group by variant — keep the cheapest active cost per variant as "preferred"
  const variantMap = new Map<
    string,
    {
      variantId: string;
      sku: string;
      productName: string;
      productId: string;
      costAmount: number;
      costCurrency: string;
      supplierName: string;
      supplierCode: string;
      saleAmount: number | null;
      saleCurrency: string;
      saleType: string | null;
      margin: number | null;
      totalStock: number;
      stockValue: number;
    }
  >();

  const variantIds = new Set([
    ...Array.from(cheapestCostPriceByVariant.keys()),
    ...Array.from(latestPurchaseByVariant.keys()),
  ]);

  for (const variantId of Array.from(variantIds)) {
    const lastPurchase = latestPurchaseByVariant.get(variantId);
    const costPrice = lastPurchase
      ? costPriceByVariantSupplier.get(`${variantId}:${lastPurchase.purchaseOrder.supplierId}`)
      : cheapestCostPriceByVariant.get(variantId);
    const variant = lastPurchase?.variant ?? costPrice?.variant;
    const supplier = lastPurchase?.purchaseOrder.supplier ?? costPrice?.supplier;
    if (!variant || !supplier) continue;

    const salePrice = variant.prices[0] ?? null;
    const costAmount = costPrice?.amount ?? lastPurchase?.unitCost;
    const costCurrency = costPrice?.currency ?? lastPurchase?.purchaseOrder.currency ?? 'CLP';
    if (costAmount === undefined) continue;
    const saleAmount = salePrice?.amount ?? null;
    const margin =
      saleAmount && saleAmount > 0
        ? ((saleAmount - costAmount) / saleAmount) * 100
        : null;

    const totalStock = variant.inventory.reduce((s, inv) => s + inv.onHand, 0);
    const stockValue = totalStock * costAmount;

    variantMap.set(variantId, {
      variantId,
      sku: variant.sku,
      productName: variant.product.name,
      productId: variant.product.id,
      costAmount,
      costCurrency,
      supplierName: supplier.name,
      supplierCode: supplier.code,
      saleAmount,
      saleCurrency: salePrice?.currency ?? costCurrency,
      saleType: salePrice?.type ?? null,
      margin,
      totalStock,
      stockValue,
    });
  }

  const rows = Array.from(variantMap.values()).sort((a, b) => (a.margin ?? 999) - (b.margin ?? 999));

  const totalInventoryValue = rows.reduce((s, r) => s + r.stockValue, 0);
  const avgMargin = rows.filter((r) => r.margin !== null).reduce((s, r) => s + (r.margin ?? 0), 0) /
    (rows.filter((r) => r.margin !== null).length || 1);

  const lowMargin = rows.filter((r) => r.margin !== null && r.margin < 20).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-500" />
            Costos y Márgenes
          </h1>
          <p className="text-sm text-muted-foreground">
            Proveedor según la última orden de compra; costo vigente de ese proveedor cuando está disponible
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/inventory">← Volver a Inventario</Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Valorización total inventario</p>
            <p className="text-xl font-bold">{fmt(totalInventoryValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Margen promedio</p>
            <p className="text-xl font-bold">{pct(avgMargin)}</p>
          </CardContent>
        </Card>
        <Card className={lowMargin > 0 ? 'border-amber-300' : ''}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Variantes margen {'<'} 20%</p>
            <p className={`text-xl font-bold ${lowMargin > 0 ? 'text-amber-600' : ''}`}>
              {lowMargin}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} variantes con costo u orden de compra</CardTitle>
          <CardDescription>Ordenado por margen ascendente — más bajo primero</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto / SKU</TableHead>
                <TableHead>Proveedor preferente</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Precio venta</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Valorización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const marginColor =
                  row.margin === null
                    ? ''
                    : row.margin < 0
                      ? 'text-red-600'
                      : row.margin < 20
                        ? 'text-amber-600'
                        : 'text-emerald-600';

                return (
                  <TableRow key={row.variantId}>
                    <TableCell>
                      <Link
                        href={`/products/${row.productId}`}
                        className="hover:underline font-medium text-sm"
                      >
                        {row.productName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.sku}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono bg-muted px-1 py-0.5 rounded">
                        {row.supplierCode}
                      </span>
                      <span className="ml-1 text-sm">{row.supplierName}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmt(row.costAmount, row.costCurrency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.saleAmount !== null ? (
                        <>
                          {fmt(row.saleAmount, row.saleCurrency)}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({row.saleType})
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sin precio</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.margin !== null ? (
                        <span className={`font-bold ${marginColor}`}>{pct(row.margin)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{row.totalStock}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {fmt(row.stockValue, row.costCurrency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
