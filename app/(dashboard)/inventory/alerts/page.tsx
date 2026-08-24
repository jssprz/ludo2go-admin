import { prisma } from '@jssprz/ludo2go-database';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Alertas de Stock' };

const LOW_STOCK_THRESHOLD = 5;

export default async function StockAlertsPage() {
  const inventories = await prisma.inventory.findMany({
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          product: { select: { id: true, name: true } },
        },
      },
      location: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ onHand: 'asc' }],
  });

  // Compute available and bucket
  type Row = {
    variantId: string;
    locationId: string;
    sku: string;
    productName: string;
    productId: string;
    locationCode: string;
    locationName: string;
    onHand: number;
    reserved: number;
    available: number;
    level: 'out' | 'critical' | 'low';
  };

  const alerts: Row[] = inventories
    .map((inv) => {
      const available = inv.onHand - inv.reserved;
      if (available > LOW_STOCK_THRESHOLD) return null;
      const level = available <= 0 ? 'out' : available <= 2 ? 'critical' : 'low';
      return {
        variantId: inv.variantId,
        locationId: inv.locationId,
        sku: inv.variant.sku,
        productName: inv.variant.product.name,
        productId: inv.variant.product.id,
        locationCode: inv.location.code,
        locationName: inv.location.name,
        onHand: inv.onHand,
        reserved: inv.reserved,
        available,
        level,
      };
    })
    .filter(Boolean) as Row[];

  const outCount = alerts.filter((r) => r.level === 'out').length;
  const criticalCount = alerts.filter((r) => r.level === 'critical').length;
  const lowCount = alerts.filter((r) => r.level === 'low').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Alertas de Stock
          </h1>
          <p className="text-sm text-muted-foreground">
            Variantes con stock disponible ≤ {LOW_STOCK_THRESHOLD} unidades
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/inventory">← Volver a Inventario</Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-200">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Sin stock</p>
            <p className="text-3xl font-bold text-red-600">{outCount}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Crítico (1–2)</p>
            <p className="text-3xl font-bold text-orange-500">{criticalCount}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Bajo (3–{LOW_STOCK_THRESHOLD})</p>
            <p className="text-3xl font-bold text-amber-500">{lowCount}</p>
          </CardContent>
        </Card>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            ✅ Todo el stock está sobre el umbral mínimo.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{alerts.length} variantes con stock bajo</CardTitle>
            <CardDescription>Ordenado por disponible ascendente</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto / SKU</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead className="text-right">En mano</TableHead>
                  <TableHead className="text-right">Reservado</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((row) => (
                  <TableRow key={`${row.variantId}-${row.locationId}`}>
                    <TableCell>
                      <Link
                        href={`/products/${row.productId}`}
                        className="hover:underline font-medium text-sm"
                      >
                        {row.productName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.sku}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                        {row.locationCode}
                      </span>
                      <span className="ml-1 text-muted-foreground">{row.locationName}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm">{row.onHand}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {row.reserved}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      <span
                        className={
                          row.level === 'out'
                            ? 'text-red-600'
                            : row.level === 'critical'
                              ? 'text-orange-500'
                              : 'text-amber-500'
                        }
                      >
                        {row.available}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.level === 'out' && (
                        <Badge variant="destructive">Sin stock</Badge>
                      )}
                      {row.level === 'critical' && (
                        <Badge className="bg-orange-100 text-orange-700">Crítico</Badge>
                      )}
                      {row.level === 'low' && (
                        <Badge className="bg-amber-100 text-amber-700">Bajo</Badge>
                      )}
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
