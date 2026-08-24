import { prisma } from '@jssprz/ludo2go-database';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, select: { code: true } });
  return { title: order ? `OC ${order.code}` : 'Orden de Compra' };
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  submitted: 'Enviada',
  confirmed: 'Confirmada',
  partially_received: 'Recibida parcialmente',
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

const RECEIVABLE = new Set(['submitted', 'confirmed', 'partially_received']);

function fmt(amount: number, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(amount);
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              product: { select: { name: true } },
              inventory: {
                include: { location: { select: { id: true, name: true, code: true } } },
              },
            },
          },
        },
        orderBy: { variantId: 'asc' },
      },
    },
  });

  if (!order) notFound();

  const canReceive = RECEIVABLE.has(order.status);
  const totalOnHand = order.items.reduce(
    (sum, item) => sum + item.variant.inventory.reduce((s, inv) => s + inv.onHand, 0),
    0,
  );
  const totalOrdered = order.items.reduce((s, i) => s + i.quantity, 0);
  const totalReceived = order.items.reduce((s, i) => s + i.quantityReceived, 0);
  const pending = totalOrdered - totalReceived;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/purchase-orders">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Órdenes de compra
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">OC {order.code}</h1>
            <Badge className={STATUS_COLORS[order.status]}>
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Proveedor: <span className="font-medium">{order.supplier.name}</span>
            {order.expectedAt && (
              <> · Entrega esperada: {new Date(order.expectedAt).toLocaleDateString('es-CL')}</>
            )}
          </p>
        </div>
        {canReceive && (
          <Button asChild>
            <Link href={`/purchase-orders/${id}/receive`}>
              <PackagePlus className="h-4 w-4 mr-2" />
              Recibir mercancía
            </Link>
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Unidades pedidas</p>
            <p className="text-2xl font-bold">{totalOrdered}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Unidades recibidas</p>
            <p className="text-2xl font-bold text-emerald-600">{totalReceived}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className={`text-2xl font-bold ${pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {pending}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total OC</p>
            <p className="text-2xl font-bold">{fmt(order.total, order.currency)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Items table */}
      <Card>
        <CardHeader>
          <CardTitle>Líneas de la orden</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto / SKU</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Recibido</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="text-right">Costo u.</TableHead>
                <TableHead className="text-right">Total línea</TableHead>
                <TableHead>Stock actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => {
                const itemPending = item.quantity - item.quantityReceived;
                const stockByLocation = item.variant.inventory;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{item.variant.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.variant.sku}</p>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">
                      {item.quantityReceived}
                    </TableCell>
                    <TableCell className="text-right">
                      {itemPending > 0 ? (
                        <span className="font-semibold text-amber-600">{itemPending}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmt(item.unitCost, order.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {fmt(item.total, order.currency)}
                    </TableCell>
                    <TableCell>
                      {stockByLocation.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin stock</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {stockByLocation.map((inv) => (
                            <span key={inv.locationId} className="text-xs">
                              <span className="font-medium">{inv.location.code}</span>: {inv.onHand}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-end">
            <div className="space-y-1 text-sm w-64">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{fmt(order.subtotal, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Envío</span>
                <span>{fmt(order.shipping, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA (19%)</span>
                <span>{fmt(order.tax, order.currency)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Total</span>
                <span>{fmt(order.total, order.currency)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
