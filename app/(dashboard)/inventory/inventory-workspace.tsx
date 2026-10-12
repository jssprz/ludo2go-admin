'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateInventoryRecommendation, type InventoryPriority } from '@/lib/inventory-recommendations';

type InventoryLocation = {
  id: string;
  name: string;
  code: string;
  available: number;
};

type Recommendation = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  weeklySales: number[];
  abcGrade: 'A' | 'B' | 'C';
  incoming: number;
  leadTimeDays: number;
  supplierId: string | null;
  supplierName: string | null;
  currency: string;
  unitCost: number | null;
  lastPurchaseCost: number | null;
  moq: number;
  packSize: number;
  locations: InventoryLocation[];
};

type Props = {
  recommendations: Recommendation[];
  locations: Array<{ id: string; name: string; code: string }>;
  children: React.ReactNode;
};

const PRIORITY_ORDER: Record<InventoryPriority, number> = {
  order_now: 0,
  order_soon: 1,
  healthy: 2,
  do_not_reorder: 3,
};

const PRIORITY_LABEL: Record<InventoryPriority, string> = {
  order_now: 'Order now',
  order_soon: 'Order soon',
  healthy: 'Healthy',
  do_not_reorder: 'Do not reorder',
};

const PRIORITY_CLASS: Record<InventoryPriority, string> = {
  order_now: 'bg-red-100 text-red-800',
  order_soon: 'bg-amber-100 text-amber-800',
  healthy: 'bg-emerald-100 text-emerald-800',
  do_not_reorder: 'bg-muted text-muted-foreground',
};

function formatCurrency(amount: number | null, currency: string) {
  if (amount === null) return '—';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(amount);
}

function getExpectedDate(leadTimeDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, leadTimeDays));
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(date);
}

export function InventoryWorkspace({ recommendations, locations, children }: Props) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState('all');
  const [supplierId, setSupplierId] = useState('all');
  const [abcGrade, setAbcGrade] = useState('all');
  const [stockoutOnly, setStockoutOnly] = useState(false);
  const [actionOnly, setActionOnly] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatingSupplierId, setCreatingSupplierId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = recommendations.map((row) => {
    const totalAvailable = row.locations.reduce((sum, location) => sum + location.available, 0);
    const focusedLocation = warehouseId === 'all'
      ? null
      : row.locations.find((location) => location.id === warehouseId) ?? null;
    const available = focusedLocation?.available ?? totalAvailable;
    const recommendation = calculateInventoryRecommendation({
      weeklySales: row.weeklySales,
      available,
      incoming: row.incoming,
      leadTimeDays: row.leadTimeDays,
      minimumOrderQuantity: row.moq,
      packSize: row.packSize,
    });

    const destination = focusedLocation ?? [...row.locations].sort((a, b) => a.available - b.available)[0];
    const perLocationTarget = Math.ceil(recommendation.targetStock / Math.max(1, row.locations.length));
    const destinationDeficit = destination ? Math.max(0, perLocationTarget - destination.available) : 0;
    const donor = [...row.locations]
      .filter((location) => location.id !== destination?.id)
      .sort((a, b) => b.available - a.available)
      .find((location) => location.available > perLocationTarget);
    const transferQuantity = donor
      ? Math.min(destinationDeficit, donor.available - perLocationTarget)
      : 0;
    const transfer = donor && destination && transferQuantity > 0
      ? { quantity: transferQuantity, from: donor, to: destination }
      : null;
    const suggestedQuantity = transfer && transfer.quantity >= destinationDeficit
      ? 0
      : recommendation.suggestedQuantity;

    return {
      ...row,
      ...recommendation,
      available,
      totalAvailable,
      suggestedQuantity,
      transfer,
    };
  });

  const filteredRows = rows
    .filter((row) => supplierId === 'all' || row.supplierId === supplierId)
    .filter((row) => abcGrade === 'all' || row.abcGrade === abcGrade)
    .filter((row) => !stockoutOnly || row.available <= 0)
    .filter((row) => !actionOnly || row.priority === 'order_now' || row.priority === 'order_soon' || !!row.transfer)
    .sort((a, b) => {
      const priorityDifference = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDifference) return priorityDifference;
      const gradeDifference = a.abcGrade.localeCompare(b.abcGrade);
      if (gradeDifference) return gradeDifference;
      if (a.daysOfCover === null) return b.daysOfCover === null ? 0 : 1;
      if (b.daysOfCover === null) return -1;
      return a.daysOfCover - b.daysOfCover || a.productName.localeCompare(b.productName);
    });

  const suppliers = Array.from(new Map(
    recommendations
      .filter((row) => row.supplierId && row.supplierName)
      .map((row) => [row.supplierId!, { id: row.supplierId!, name: row.supplierName! }])
  ).values()).sort((a, b) => a.name.localeCompare(b.name));

  const groupedRows = new Map<string, typeof filteredRows>();
  for (const row of filteredRows) {
    const key = row.supplierId ?? 'none';
    groupedRows.set(key, [...(groupedRows.get(key) ?? []), row]);
  }

  function toggleSelected(variantId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  }

  function getSelectedGroup(supplierRows: typeof filteredRows) {
    return supplierRows.filter((row) => selectedIds.has(row.variantId)
      && row.supplierId
      && row.suggestedQuantity > 0
      && (row.unitCost !== null || row.lastPurchaseCost !== null));
  }

  async function createDraft(supplierRows: typeof filteredRows) {
    const selected = getSelectedGroup(supplierRows);
    if (!selected.length || !selected[0].supplierId) return;
    const groupSupplierId = selected[0].supplierId;
    setCreatingSupplierId(groupSupplierId);
    setError(null);
    try {
      const expectedAt = new Date();
      expectedAt.setDate(expectedAt.getDate() + Math.max(...selected.map((row) => row.leadTimeDays)));
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: groupSupplierId,
          currency: selected[0].currency,
          expectedAt: expectedAt.toISOString(),
          notes: 'Created from inventory recommendations',
          items: selected.map((row) => ({
            variantId: row.variantId,
            quantity: row.suggestedQuantity,
            unitCost: row.unitCost ?? row.lastPurchaseCost ?? 0,
            discount: 0,
          })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not create purchase order');
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const row of selected) next.delete(row.variantId);
        return next;
      });
      router.push(`/purchase-orders/${result.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create purchase order');
    } finally {
      setCreatingSupplierId(null);
    }
  }

  async function executeTransfer(row: (typeof filteredRows)[number]) {
    if (!row.transfer) return;
    setError(null);
    try {
      const response = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: row.variantId,
          fromLocationId: row.transfer.from.id,
          toLocationId: row.transfer.to.id,
          quantity: row.transfer.quantity,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not transfer inventory');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not transfer inventory');
    }
  }

  return (
    <Tabs defaultValue="recommendations" className="space-y-4">
      <TabsList>
        <TabsTrigger value="recommendations">Order recommendations</TabsTrigger>
        <TabsTrigger value="stock">Stock by warehouse</TabsTrigger>
      </TabsList>
      <TabsContent value="recommendations" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Warehouse" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="w-[190px]"><SelectValue placeholder="Supplier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={abcGrade} onValueChange={setAbcGrade}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="ABC grade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All grades</SelectItem>
              <SelectItem value="A">Grade A</SelectItem>
              <SelectItem value="B">Grade B</SelectItem>
              <SelectItem value="C">Grade C</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
            <Checkbox checked={stockoutOnly} onCheckedChange={(value) => setStockoutOnly(value === true)} />
            Stockout
          </label>
          <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
            <Checkbox checked={actionOnly} onCheckedChange={(value) => setActionOnly(value === true)} />
            Only products requiring action
          </label>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Priority</TableHead>
                <TableHead>Product / SKU</TableHead>
                <TableHead>ABC</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Incoming</TableHead>
                <TableHead className="text-right">Sales/week</TableHead>
                <TableHead className="text-right">Days of cover</TableHead>
                <TableHead className="text-right">Lead time</TableHead>
                <TableHead className="text-right">Reorder point</TableHead>
                <TableHead className="text-right">Suggested quantity</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Estimated cost</TableHead>
                <TableHead className="text-right">Last purchase cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(groupedRows.entries()).map(([groupId, supplierRows]) => {
                const selected = getSelectedGroup(supplierRows);
                const subtotal = selected.reduce((sum, row) => sum + row.suggestedQuantity * (row.unitCost ?? row.lastPurchaseCost ?? 0), 0);
                const groupName = supplierRows[0]?.supplierName ?? 'No supplier';
                const leadTime = Math.max(...supplierRows.map((row) => row.leadTimeDays));
                const busy = creatingSupplierId === groupId;
                return (
                  <Fragment key={groupId}>
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={9} className="font-semibold">
                        {groupName} <span className="ml-2 font-normal text-muted-foreground">{supplierRows.length} products</span>
                      </TableCell>
                      <TableCell colSpan={3} className="text-right text-xs text-muted-foreground">
                        MOQ / pack size shown per item
                      </TableCell>
                      <TableCell colSpan={2} className="text-right">
                        <span className="mr-3 text-xs text-muted-foreground">
                          Subtotal {formatCurrency(subtotal, supplierRows[0]?.currency ?? 'CLP')} · ETA {getExpectedDate(leadTime)}
                        </span>
                        {groupId !== 'none' && (
                          <Button size="sm" onClick={() => createDraft(supplierRows)} disabled={!selected.length || busy}>
                            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Create draft PO ({selected.length})
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {supplierRows.map((row) => (
                      <TableRow key={row.variantId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(row.variantId)}
                            disabled={!row.supplierId || row.suggestedQuantity <= 0 || (row.unitCost === null && row.lastPurchaseCost === null)}
                            onCheckedChange={() => toggleSelected(row.variantId)}
                            aria-label={`Select ${row.productName} for purchase order`}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge className={PRIORITY_CLASS[row.priority]}>{PRIORITY_LABEL[row.priority]}</Badge>
                          {row.transfer && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-sky-700">
                              <ArrowLeftRight className="h-3 w-3" />
                              Transfer {row.transfer.quantity} from {row.transfer.from.name}
                              <Button size="sm" variant="ghost" className="h-6 px-1 text-xs" onClick={() => executeTransfer(row)}>Apply</Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/variants/${row.variantId}/edit`} className="font-medium hover:underline">{row.productName}</Link>
                          <div className="font-mono text-xs text-muted-foreground">{row.sku}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{row.abcGrade}</Badge></TableCell>
                        <TableCell className="text-right">{row.available}</TableCell>
                        <TableCell className="text-right">{row.incoming}</TableCell>
                        <TableCell className="text-right">{row.salesPerWeek.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{row.daysOfCover === null ? '—' : `${Math.floor(row.daysOfCover)} d`}</TableCell>
                        <TableCell className="text-right">{row.leadTimeDays} d</TableCell>
                        <TableCell className="text-right">{row.reorderPoint}</TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold">{row.suggestedQuantity || '—'}</div>
                          {row.suggestedQuantity > 0 && <div className="text-xs text-muted-foreground">MOQ {row.moq} · Pack {row.packSize}</div>}
                        </TableCell>
                        <TableCell>{row.supplierName ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(
                            row.unitCost === null && row.lastPurchaseCost === null
                              ? null
                              : row.suggestedQuantity * (row.unitCost ?? row.lastPurchaseCost!),
                            row.currency
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(row.lastPurchaseCost, row.currency)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
              {filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={14} className="py-10 text-center text-muted-foreground">No matching inventory recommendations.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
      <TabsContent value="stock">{children}</TabsContent>
    </Tabs>
  );
}