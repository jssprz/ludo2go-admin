'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type Location = { id: string; name: string; code: string };

type OrderItem = {
  id: string;
  quantity: number;
  quantityReceived: number;
  unitCost: number;
  variant: { id: string; sku: string; product: { name: string } };
};

type Props = {
  orderId: string;
  orderCode: string;
  currency: string;
  items: OrderItem[];
  locations: Location[];
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(amount);
}

export function ReceiveForm({ orderId, orderCode, currency, items, locations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.quantity - i.quantityReceived])),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const receivableItems = items.filter((i) => i.quantity - i.quantityReceived > 0);

  function setQty(itemId: string, value: string) {
    const num = Math.max(0, parseInt(value) || 0);
    const item = items.find((i) => i.id === itemId);
    const max = item ? item.quantity - item.quantityReceived : 0;
    setQuantities((prev) => ({ ...prev, [itemId]: Math.min(num, max) }));
  }

  function setAllToMax() {
    setQuantities(Object.fromEntries(items.map((i) => [i.id, i.quantity - i.quantityReceived])));
  }

  function setAllToZero() {
    setQuantities(Object.fromEntries(items.map((i) => [i.id, 0])));
  }

  const totalReceivingNow = Object.values(quantities).reduce((s, n) => s + n, 0);

  function handleSubmit() {
    if (!locationId) {
      setError('Selecciona una bodega de destino.');
      return;
    }
    if (totalReceivingNow === 0) {
      setError('Ingresa al menos una unidad a recibir.');
      return;
    }

    const itemsPayload = receivableItems
      .map((i) => ({ itemId: i.id, quantityNow: quantities[i.id] ?? 0 }))
      .filter((i) => i.quantityNow > 0);

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/purchase-orders/${orderId}/receive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locationId, items: itemsPayload }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? 'Error al procesar la recepción.');
          return;
        }
        setSuccess(true);
        setTimeout(() => router.push(`/purchase-orders/${orderId}`), 1200);
      } catch {
        setError('Error de red. Intenta nuevamente.');
      }
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h2 className="text-xl font-semibold">Recepción registrada</h2>
        <p className="text-muted-foreground text-sm">Redirigiendo a la orden…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Destination warehouse */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bodega de destino</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="location">Recibir en</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="location" className="mt-1">
                <SelectValue placeholder="Selecciona bodega…" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.code} — {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Cantidades a recibir</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={setAllToMax}>
              Todo pendiente
            </Button>
            <Button variant="ghost" size="sm" onClick={setAllToZero}>
              Limpiar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto / SKU</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Ya recibido</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="text-right w-36">Recibir ahora</TableHead>
                <TableHead className="text-right">Costo u.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const pending = item.quantity - item.quantityReceived;
                const qty = quantities[item.id] ?? 0;
                const isFullyReceived = pending === 0;
                return (
                  <TableRow key={item.id} className={isFullyReceived ? 'opacity-50' : ''}>
                    <TableCell>
                      <p className="font-medium text-sm">{item.variant.product.name}</p>
                      <p className="text-xs text-muted-foreground">{item.variant.sku}</p>
                    </TableCell>
                    <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm text-emerald-600">
                      {item.quantityReceived}
                    </TableCell>
                    <TableCell className="text-right">
                      {isFullyReceived ? (
                        <Badge variant="secondary" className="text-xs">Completo</Badge>
                      ) : (
                        <span className="font-semibold text-amber-600">{pending}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isFullyReceived ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={pending}
                          value={qty}
                          onChange={(e) => setQty(item.id, e.target.value)}
                          className="w-24 ml-auto text-right h-8"
                          aria-label={`Cantidad a recibir de ${item.variant.product.name}`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {fmt(item.unitCost, currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Error / Submit */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Total a recibir ahora:{' '}
          <span className="font-semibold text-foreground">{totalReceivingNow} unidades</span>
        </p>
        <Button onClick={handleSubmit} disabled={isPending || totalReceivingNow === 0}>
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Confirmar recepción
        </Button>
      </div>
    </div>
  );
}
