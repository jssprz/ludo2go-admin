'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ProductVariant, Product, Inventory, Location } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Save,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileDown,
} from 'lucide-react';
import Link from 'next/link';

type VariantWithInventory = ProductVariant & {
  product: Pick<Product, 'id' | 'name' | 'slug'>;
  inventory: (Inventory & { location: Location })[];
};

type Props = {
  variants: VariantWithInventory[];
  locations: Location[];
};

type EditingState = {
  variantId: string;
  locationId: string;
  onHand: number;
  reserved: number;
} | null;

const LOW_STOCK_THRESHOLD = Number(process.env.NEXT_PUBLIC_LOW_STOCK_THRESHOLD ?? 5);
const CRITICAL_STOCK_THRESHOLD = Number(process.env.NEXT_PUBLIC_CRITICAL_STOCK_THRESHOLD ?? 2);

export function InventoryTable({ variants, locations }: Props) {
  const t = useTranslations('locations');
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<string>(
    locations[0]?.id || 'all'
  );
  const [editingCell, setEditingCell] = useState<EditingState>(null);
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<string>('product');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [exportingScope, setExportingScope] = useState<string | null>(null);

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-40 inline-block" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 h-3.5 w-3.5 inline-block" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5 inline-block" />;
  }

  // Filter variants by search query
  const filteredVariants = variants.filter((variant) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      variant.product.name.toLowerCase().includes(searchLower) ||
      variant.sku.toLowerCase().includes(searchLower) ||
      variant.edition?.toLowerCase().includes(searchLower)
    );
  });

  const sortedVariants = [...filteredVariants].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;

    const getVals = (v: VariantWithInventory) => {
      if (selectedLocation === 'all') {
        const t = getTotalStock(v);
        return { onHand: t.onHand, reserved: t.reserved, available: calculateAvailable(t.onHand, t.reserved) };
      }
      const inv = v.inventory.find((i) => i.locationId === selectedLocation);
      const onHand = inv?.onHand ?? 0;
      const reserved = inv?.reserved ?? 0;
      return { onHand, reserved, available: calculateAvailable(onHand, reserved) };
    };

    switch (sortCol) {
      case 'product': return dir * a.product.name.localeCompare(b.product.name);
      case 'sku': return dir * a.sku.localeCompare(b.sku);
      case 'status': return dir * (a.status ?? '').localeCompare(b.status ?? '');
      case 'onHand': return dir * (getVals(a).onHand - getVals(b).onHand);
      case 'reserved': return dir * (getVals(a).reserved - getVals(b).reserved);
      case 'available': return dir * (getVals(a).available - getVals(b).available);
      default: return 0;
    }
  });

  function getInventoryForLocation(
    variant: VariantWithInventory,
    locationId: string
  ) {
    return variant.inventory.find((inv) => inv.locationId === locationId);
  }

  function calculateAvailable(onHand: number, reserved: number) {
    return onHand - reserved;
  }

  function getStockStatus(available: number) {
    if (available <= 0) return 'out';
    if (available <= CRITICAL_STOCK_THRESHOLD) return 'critical';
    if (available <= LOW_STOCK_THRESHOLD) return 'low';
    return 'ok';
  }

  function getStockBadgeClass(status: string) {
    switch (status) {
      case 'out':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'critical':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'low':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
  }

  function getTotalStock(variant: VariantWithInventory) {
    return variant.inventory.reduce(
      (acc, inv) => {
        acc.onHand += inv.onHand;
        acc.reserved += inv.reserved;
        return acc;
      },
      { onHand: 0, reserved: 0 }
    );
  }

  function calculateTableTotals() {
    if (selectedLocation === 'all') {
      return filteredVariants.reduce(
        (acc, variant) => {
          const total = getTotalStock(variant);
          const available = calculateAvailable(total.onHand, total.reserved);
          acc.onHand += total.onHand;
          acc.reserved += total.reserved;
          acc.available += available;
          return acc;
        },
        { onHand: 0, reserved: 0, available: 0 }
      );
    } else {
      return filteredVariants.reduce(
        (acc, variant) => {
          const inventory = getInventoryForLocation(variant, selectedLocation);
          const onHand = inventory?.onHand || 0;
          const reserved = inventory?.reserved || 0;
          const available = calculateAvailable(onHand, reserved);
          acc.onHand += onHand;
          acc.reserved += reserved;
          acc.available += available;
          return acc;
        },
        { onHand: 0, reserved: 0, available: 0 }
      );
    }
  }

  function calculateLocationSummaries() {
    return locations.map((location) => {
      const summary = filteredVariants.reduce(
        (acc, variant) => {
          const inventory = getInventoryForLocation(variant, location.id);
          const onHand = inventory?.onHand || 0;
          const reserved = inventory?.reserved || 0;
          const available = calculateAvailable(onHand, reserved);
          const status = getStockStatus(available);

          acc.onHand += onHand;
          acc.reserved += reserved;
          acc.available += available;

          if (status === 'out') acc.out += 1;
          if (status === 'critical') acc.critical += 1;
          if (status === 'low') acc.low += 1;

          return acc;
        },
        {
          onHand: 0,
          reserved: 0,
          available: 0,
          low: 0,
          critical: 0,
          out: 0,
        }
      );

      return {
        location,
        ...summary,
      };
    });
  }

  function calculateTotalSummary() {
    return filteredVariants.reduce(
      (acc, variant) => {
        const total = getTotalStock(variant);
        const available = calculateAvailable(total.onHand, total.reserved);
        const status = getStockStatus(available);

        acc.onHand += total.onHand;
        acc.reserved += total.reserved;
        acc.available += available;

        if (status === 'out') acc.out += 1;
        if (status === 'critical') acc.critical += 1;
        if (status === 'low') acc.low += 1;

        return acc;
      },
      {
        onHand: 0,
        reserved: 0,
        available: 0,
        low: 0,
        critical: 0,
        out: 0,
      }
    );
  }

  function slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  async function exportInventoryPdf(scope: 'all' | string, scopeLabel: string) {
    setExportingScope(scope);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const rows = sortedVariants.map((variant) => {
        if (scope === 'all') {
          const total = getTotalStock(variant);
          const available = calculateAvailable(total.onHand, total.reserved);
          return {
            product: variant.product.name,
            sku: variant.sku,
            status: variant.status ?? '—',
            onHand: total.onHand,
            reserved: total.reserved,
            available,
          };
        }

        const inventory = getInventoryForLocation(variant, scope);
        const onHand = inventory?.onHand ?? 0;
        const reserved = inventory?.reserved ?? 0;
        const available = calculateAvailable(onHand, reserved);
        return {
          product: variant.product.name,
          sku: variant.sku,
          status: variant.status ?? '—',
          onHand,
          reserved,
          available,
        };
      });

      const totals = rows.reduce(
        (acc, row) => {
          acc.onHand += row.onHand;
          acc.reserved += row.reserved;
          acc.available += row.available;
          return acc;
        },
        { onHand: 0, reserved: 0, available: 0 }
      );

      const doc = new jsPDF({ orientation: 'landscape' });
      const generatedAt = new Date().toLocaleString();

      doc.setFontSize(16);
      doc.text('Inventory Report', 14, 16);
      doc.setFontSize(10);
      doc.text(`Summary Card: ${scopeLabel}`, 14, 23);
      doc.text(`Generated: ${generatedAt}`, 14, 28);
      doc.text(`Rows: ${rows.length}`, 14, 33);

      (autoTable as any)(doc, {
        startY: 38,
        head: [['Product', 'SKU', 'Status', 'On Hand', 'Reserved', 'Available']],
        body: rows.map((row) => [
          row.product,
          row.sku,
          row.status,
          row.onHand,
          row.reserved,
          row.available,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [31, 41, 55] },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 38;
      doc.setFontSize(11);
      doc.text(
        `Totals - On Hand: ${totals.onHand} | Reserved: ${totals.reserved} | Available: ${totals.available}`,
        14,
        finalY + 10
      );

      const dateTag = new Date().toISOString().slice(0, 10);
      doc.save(`inventory-${slugify(scopeLabel)}-${dateTag}.pdf`);
    } catch (err) {
      console.error('Failed to export PDF', err);
      alert('Failed to export inventory PDF. Please try again.');
    } finally {
      setExportingScope(null);
    }
  }

  async function handleSave(variantId: string) {
    if (!editingCell) return;

    setSavingVariantId(variantId);
    try {
      const res = await fetch(`/api/inventory/${variantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: editingCell.locationId,
          onHand: editingCell.onHand,
          reserved: editingCell.reserved,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to update inventory');
      }

      setEditingCell(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Unexpected error');
    } finally {
      setSavingVariantId(null);
    }
  }

  function handleCancel() {
    setEditingCell(null);
  }

  function startEditing(
    variantId: string,
    locationId: string,
    currentOnHand: number,
    currentReserved: number
  ) {
    setEditingCell({
      variantId,
      locationId,
      onHand: currentOnHand,
      reserved: currentReserved,
    });
  }

  function isEditing(variantId: string, locationId: string) {
    return (
      editingCell?.variantId === variantId &&
      editingCell?.locationId === locationId
    );
  }

  if (variants.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        No variants found.
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        No locations found. Please create locations first.
      </div>
    );
  }

  const locationSummaries = calculateLocationSummaries();
  const totalSummary = calculateTotalSummary();

  return (
    <div className="space-y-4">
      {/* Per-Location Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card className={selectedLocation === 'all' ? 'ring-1 ring-primary' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-medium">Total Summary</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => exportInventoryPdf('all', 'all-locations')}
                disabled={exportingScope === 'all'}
              >
                <FileDown className="mr-1 h-4 w-4" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">On Hand</div>
                <div className="text-base font-semibold">{totalSummary.onHand}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Reserved</div>
                <div className="text-base font-semibold">{totalSummary.reserved}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Available</div>
                <div className="text-base font-semibold">{totalSummary.available}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {totalSummary.out > 0 && (
                <Badge className={getStockBadgeClass('out')}>Out: {totalSummary.out}</Badge>
              )}
              {totalSummary.critical > 0 && (
                <Badge className={getStockBadgeClass('critical')}>
                  Critical: {totalSummary.critical}
                </Badge>
              )}
              {totalSummary.low > 0 && (
                <Badge className={getStockBadgeClass('low')}>Low: {totalSummary.low}</Badge>
              )}
              {totalSummary.out === 0 && totalSummary.critical === 0 && totalSummary.low === 0 && (
                <Badge className={getStockBadgeClass('ok')}>Healthy</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {locationSummaries.map((summary) => (
          <Card
            key={summary.location.id}
            className={selectedLocation === summary.location.id ? 'ring-1 ring-primary' : ''}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium">
                  {summary.location.name}
                </CardTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => exportInventoryPdf(summary.location.id, summary.location.name)}
                  disabled={exportingScope === summary.location.id}
                >
                  <FileDown className="mr-1 h-4 w-4" />
                  PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">On Hand</div>
                  <div className="text-base font-semibold">{summary.onHand}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Reserved</div>
                  <div className="text-base font-semibold">{summary.reserved}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Available</div>
                  <div className="text-base font-semibold">{summary.available}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {summary.out > 0 && (
                  <Badge className={getStockBadgeClass('out')}>Out: {summary.out}</Badge>
                )}
                {summary.critical > 0 && (
                  <Badge className={getStockBadgeClass('critical')}>
                    Critical: {summary.critical}
                  </Badge>
                )}
                {summary.low > 0 && (
                  <Badge className={getStockBadgeClass('low')}>Low: {summary.low}</Badge>
                )}
                {summary.out === 0 && summary.critical === 0 && summary.low === 0 && (
                  <Badge className={getStockBadgeClass('ok')}>Healthy</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 items-center">
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allLocations')}</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          placeholder="Search by product or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Stock Status Legend */}
      <div className="flex gap-4 text-xs items-center flex-wrap">
        <span className="text-muted-foreground">Stock Status:</span>
        <Badge className={getStockBadgeClass('ok')}>In Stock</Badge>
        <Badge className={getStockBadgeClass('low')}>
          Low (&le;{LOW_STOCK_THRESHOLD})
        </Badge>
        <Badge className={getStockBadgeClass('critical')}>
          Critical (&le;{CRITICAL_STOCK_THRESHOLD})
        </Badge>
        <Badge className={getStockBadgeClass('out')}>Out of Stock</Badge>
      </div>

      {/* Inventory Table */}
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('product')}>
                Product <SortIcon col="product" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('sku')}>
                SKU <SortIcon col="sku" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                Status <SortIcon col="status" />
              </TableHead>
              {selectedLocation === 'all' ? (
                <>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('onHand')}>
                    Total On Hand <SortIcon col="onHand" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('reserved')}>
                    Total Reserved <SortIcon col="reserved" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('available')}>
                    Total Available <SortIcon col="available" />
                  </TableHead>
                </>
              ) : (
                <>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('onHand')}>
                    On Hand <SortIcon col="onHand" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('reserved')}>
                    Reserved <SortIcon col="reserved" />
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('available')}>
                    Available <SortIcon col="available" />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedVariants.map((variant) => {
              if (selectedLocation === 'all') {
                const total = getTotalStock(variant);
                const available = calculateAvailable(
                  total.onHand,
                  total.reserved
                );
                const status = getStockStatus(available);

                return (
                  <TableRow
                    key={variant.id}
                    className={
                      status === 'critical' || status === 'out'
                        ? 'bg-red-50 dark:bg-red-950/10'
                        : status === 'low'
                          ? 'bg-yellow-50 dark:bg-yellow-950/10'
                          : ''
                    }
                  >
                    <TableCell>
                      <Link
                        href={`/products/${variant.product.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {variant.product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {variant.sku}
                    </TableCell>
                    <TableCell className="text-sm">
                      {variant.status}
                    </TableCell>
                    <TableCell className="text-right">{total.onHand}</TableCell>
                    <TableCell className="text-right">
                      {total.reserved}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(status === 'critical' || status === 'low') && (
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                        )}
                        <Badge className={getStockBadgeClass(status)}>
                          {available}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              } else {
                const inventory = getInventoryForLocation(
                  variant,
                  selectedLocation
                );
                const onHand = inventory?.onHand || 0;
                const reserved = inventory?.reserved || 0;
                const available = calculateAvailable(onHand, reserved);
                const status = getStockStatus(available);
                const editing = isEditing(variant.id, selectedLocation);

                return (
                  <TableRow
                    key={variant.id}
                    className={
                      status === 'critical' || status === 'out'
                        ? 'bg-red-50 dark:bg-red-950/10'
                        : status === 'low'
                          ? 'bg-yellow-50 dark:bg-yellow-950/10'
                          : ''
                    }
                  >
                    <TableCell>
                      <Link
                        href={`/products/${variant.product.id}/edit`}
                        className="font-medium hover:underline"
                      >
                        {variant.product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {variant.sku}
                    </TableCell>
                    <TableCell className="text-sm">
                      {variant.status}
                    </TableCell>
                    <TableCell className="text-right">
                      {editing && editingCell ? (
                        <Input
                          type="number"
                          min="0"
                          value={editingCell.onHand}
                          onChange={(e) =>
                            setEditingCell({
                              variantId: editingCell.variantId,
                              locationId: editingCell.locationId,
                              onHand: parseInt(e.target.value) || 0,
                              reserved: editingCell.reserved,
                            })
                          }
                          className="w-20 text-right"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() =>
                            startEditing(
                              variant.id,
                              selectedLocation,
                              onHand,
                              reserved
                            )
                          }
                          className="hover:underline cursor-pointer"
                        >
                          {onHand}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editing && editingCell ? (
                        <Input
                          type="number"
                          min="0"
                          value={editingCell.reserved}
                          onChange={(e) =>
                            setEditingCell({
                              variantId: editingCell.variantId,
                              locationId: editingCell.locationId,
                              onHand: editingCell.onHand,
                              reserved: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-20 text-right"
                        />
                      ) : (
                        <button
                          onClick={() =>
                            startEditing(
                              variant.id,
                              selectedLocation,
                              onHand,
                              reserved
                            )
                          }
                          className="hover:underline cursor-pointer"
                        >
                          {reserved}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editing && editingCell ? (
                        <Badge
                          className={getStockBadgeClass(
                            getStockStatus(
                              calculateAvailable(
                                editingCell.onHand,
                                editingCell.reserved
                              )
                            )
                          )}
                        >
                          {calculateAvailable(
                            editingCell.onHand,
                            editingCell.reserved
                          )}
                        </Badge>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {(status === 'critical' || status === 'low') && (
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                          )}
                          <Badge className={getStockBadgeClass(status)}>
                            {available}
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editing ? (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSave(variant.id)}
                            disabled={savingVariantId === variant.id}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            disabled={savingVariantId === variant.id}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                        >
                          <Link href={`/variants/${variant.id}/edit`}>
                            View
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              }
            })}
            {sortedVariants.length > 0 && (() => {
              const totals = calculateTableTotals();
              return (
                <TableRow className="font-semibold bg-muted/50 border-t-2 border-t-border">
                  <TableCell colSpan={3}>Total</TableCell>
                  {selectedLocation === 'all' ? (
                    <>
                      <TableCell className="text-right">{totals.onHand}</TableCell>
                      <TableCell className="text-right">{totals.reserved}</TableCell>
                      <TableCell className="text-right">{totals.available}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-right">{totals.onHand}</TableCell>
                      <TableCell className="text-right">{totals.reserved}</TableCell>
                      <TableCell className="text-right">{totals.available}</TableCell>
                      <TableCell />
                    </>
                  )}
                </TableRow>
              );
            })()}
          </TableBody>
        </Table>
      </div>

      {filteredVariants.length === 0 && searchQuery && (
        <p className="text-center text-muted-foreground py-4">
          No variants found matching "{searchQuery}"
        </p>
      )}
    </div>
  );
}
