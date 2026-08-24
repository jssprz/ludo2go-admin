import { prisma } from '@jssprz/ludo2go-database';
import Link from 'next/link';
import { GitCompareArrows } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata = { title: 'Discrepancias de Inventario' };

function fmt(n: number, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(n);
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviada',
  confirmed: 'Confirmada',
  partially_received: 'Parcial',
  received: 'Recibida',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  partially_received: 'bg-amber-100 text-amber-800',
  received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default async function DiscrepanciesPage() {
  // All non-cancelled POs that have unfully-received items
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      status: { notIn: ['cancelled', 'received'] },
    },
    include: {
      supplier: { select: { id: true, name: true } },
      items: {
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              product: { select: { id: true, name: true } },
              inventory: {
                include: { location: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { orderedAt: 'desc' },
  });

  type DiscrepancyRow = {
    orderId: string;
    orderCode: string;
    orderStatus: string;
    currency: string;
    supplierName: string;
    orderedAt: Date | null;
    expectedAt: Date | null;
    itemId: string;
    sku: string;
    productName: string;
    productId: string;
    ordered: number;
    received: number;
    gap: number;
    currentStock: number;
    unitCost: number;
    gapValue: number;
  };

  const rows: DiscrepancyRow[] = [];

  for (const order of orders) {
    for (const item of order.items) {
      const gap = item.quantity - item.quantityReceived;
      if (gap <= 0) continue;

      const currentStock = item.variant.inventory.reduce((s, inv) => s + inv.onHand, 0);

      rows.push({
        orderId: order.id,
        orderCode: order.code,
        orderStatus: order.status,
        currency: order.currency,
        supplierName: order.supplier.name,
        orderedAt: order.orderedAt,
        expectedAt: order.expectedAt,
        itemId: item.id,
        sku: item.variant.sku,
        productName: item.variant.product.name,
        productId: item.variant.product.id,
        ordered: item.quantity,
        received: item.quantityReceived,
        gap,
        currentStock,
        unitCost: item.unitCost,
        gapValue: gap * item.unitCost,
      });
    }
  }

  const totalGapValue = rows.reduce((s, r) => s + r.gapValue, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitCompareArrows className="h-6 w-6 text-indigo-500" />
            Discrepancias Pedido vs Recepción
          </h1>
          <p className="text-sm text-muted-foreground">
            Líneas de OC no completamente recibidas (excluyendo canceladas y cerradas)
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/inventory">← Volver a Inventario</Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">OC con pendientes</p>
            <p className="text-3xl font-bold">{new Set(rows.map((r) => r.orderId)).size}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Líneas pendientes</p>
            <p className="text-3xl font-bold">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Valor pendiente estimado</p>
            <p className="text-2xl font-bold">{fmt(totalGapValue)}</p>
          </CardContent>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            ✅ No hay discrepancias pendientes.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{rows.length} líneas con pendientes</CardTitle>
            <CardDescription>Haz clic en el código OC para ir al detalle o registrar recepción</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OC</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Producto / SKU</TableHead>
                  <TableHead className="text-right">Pedido</TableHead>
                  <TableHead className="text-right">Recibido</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead className="text-right">Stock actual</TableHead>
                  <TableHead className="text-right">Valor pend.</TableHead>
                  <TableHead>F. esperada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.itemId}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/purchase-orders/${row.orderId}`}
                          className="font-mono text-xs font-semibold hover:underline text-indigo-700"
                        >
                          {row.orderCode}
                        </Link>
                        <Badge className={`text-xs w-fit ${STATUS_COLORS[row.orderStatus]}`}>
                          {STATUS_LABELS[row.orderStatus] ?? row.orderStatus}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{row.supplierName}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{row.productName}</p>
                      <p className="text-xs text-muted-foreground">{row.sku}</p>
                    </TableCell>
                    <TableCell className="text-right text-sm">{row.ordered}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600">
                      {row.received}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-amber-600">{row.gap}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <span className={row.currentStock === 0 ? 'text-red-600 font-bold' : ''}>
                        {row.currentStock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {fmt(row.gapValue, row.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.expectedAt
                        ? new Date(row.expectedAt).toLocaleDateString('es-CL')
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
