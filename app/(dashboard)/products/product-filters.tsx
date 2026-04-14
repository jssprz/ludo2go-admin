'use client';

import { useRouter } from 'next/navigation';
import { ProductKind } from '@prisma/client';
import { SortableProductColumn, SortOrder } from '@/lib/db';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PRODUCT_KINDS: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'game', label: 'Game' },
  { value: 'expansion', label: 'Expansion' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'merch', label: 'Merch' },
];

interface Brand {
  id: string;
  name: string;
  slug: string;
}

export function ProductFiltersBar({
  brands,
  currentKind,
  currentBrandId,
  currentSearch,
  currentStatus,
  currentSortBy,
  currentSortOrder,
}: {
  brands: Brand[];
  currentKind: string;
  currentBrandId: string;
  currentSearch: string;
  currentStatus: string;
  currentSortBy: SortableProductColumn;
  currentSortOrder: SortOrder;
}) {
  const router = useRouter();

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      q: currentSearch,
      status: currentStatus,
      sortBy: currentSortBy,
      sortOrder: currentSortOrder,
      kind: currentKind,
      brandId: currentBrandId,
      ...overrides,
    });
    // Remove empty params
    for (const [key, value] of Array.from(params.entries())) {
      if (!value) params.delete(key);
    }
    return `/products?${params.toString()}`;
  }

  const hasActiveFilters = currentKind || currentBrandId;

  return (
    <div className="flex items-center gap-3 py-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filters:</span>
      </div>

      {/* Kind filter */}
      <select
        value={currentKind}
        onChange={(e) => router.push(buildUrl({ kind: e.target.value, offset: '' }))}
        className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {PRODUCT_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>

      {/* Brand filter */}
      <select
        value={currentBrandId}
        onChange={(e) => router.push(buildUrl({ brandId: e.target.value, offset: '' }))}
        className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">All Brands</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-muted-foreground"
          onClick={() => router.push(buildUrl({ kind: '', brandId: '', offset: '' }))}
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
