'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductVariant, Product, Inventory, Location } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { AlertTriangle, Save, X } from 'lucide-react';
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

const LOW_STOCK_THRESHOLD = 10; // Highlight if available stock is below this
const CRITICAL_STOCK_THRESHOLD = 5; // Critical if available stock is below this

export function InventoryTable({ variants, locations }: Props) {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<string>(
    locations[0]?.id || 'all'
  );
  const [editingCell, setEditingCell] = useState<EditingState>(null);
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter variants by search query
  const filteredVariants = variants.filter((variant) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      variant.product.name.toLowerCase().includes(searchLower) ||
      variant.sku.toLowerCase().includes(searchLower) ||
      variant.edition?.toLowerCase().includes(searchLower)
    );
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 items-center">
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
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
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Edition</TableHead>
              {selectedLocation === 'all' ? (
                <>
                  <TableHead className="text-right">Total On Hand</TableHead>
                  <TableHead className="text-right">Total Reserved</TableHead>
                  <TableHead className="text-right">Total Available</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVariants.map((variant) => {
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
                      {variant.edition || '-'}
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
                      {variant.edition || '-'}
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
