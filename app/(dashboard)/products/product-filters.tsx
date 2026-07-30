'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ProductKind } from '@prisma/client';
import { SortableProductColumn, SortOrder } from '@/lib/db';
import { Filter, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/icons';
import { DEFAULT_BESTSELLER_DAYS, DEFAULT_POPULAR_DAYS } from '@/lib/db';

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
  currentBestsellerDays,
  currentPopularDays,
}: {
  brands: Brand[];
  currentKind: string;
  currentBrandId: string;
  currentSearch: string;
  currentStatus: string;
  currentSortBy: SortableProductColumn;
  currentSortOrder: SortOrder;
  currentBestsellerDays: string;
  currentPopularDays: string;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(currentSearch);
  const [bestsellerDaysValue, setBestsellerDaysValue] = useState(currentBestsellerDays);
  const [popularDaysValue, setPopularDaysValue] = useState(currentPopularDays);
  const [isPending, startTransition] = useTransition();

  function buildUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams({
      q: currentSearch,
      status: currentStatus,
      sortBy: currentSortBy,
      sortOrder: currentSortOrder,
      kind: currentKind,
      brandId: currentBrandId,
      bestsellerDays: currentBestsellerDays,
      popularDays: currentPopularDays,
      ...overrides,
    });
    // Remove empty params
    for (const [key, value] of Array.from(params.entries())) {
      if (!value) params.delete(key);
    }
    return `/products?${params.toString()}`;
  }

  const hasActiveFilters =
    currentKind ||
    currentBrandId ||
    currentSearch ||
    currentBestsellerDays !== String(DEFAULT_BESTSELLER_DAYS) ||
    currentPopularDays !== String(DEFAULT_POPULAR_DAYS);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      router.push(buildUrl({ q: searchValue, offset: '' }));
    });
  }

  function handleWindowDaysSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      router.push(
        buildUrl({
          bestsellerDays: bestsellerDaysValue,
          popularDays: popularDaysValue,
          offset: '',
        })
      );
    });
  }

  return (
    <div className="flex items-center gap-3 py-3 flex-wrap">
      {/* Search by name */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-2.5 top-[0.45rem] h-4 w-4 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          type="search"
          placeholder="Search by name or BGG ID…"
          className="h-8 w-[200px] lg:w-[280px] rounded-md pl-8 text-sm"
        />
        {isPending && (
          <div className="absolute right-2.5 top-[0.45rem]">
            <Spinner />
          </div>
        )}
      </form>

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
          onClick={() => {
            setSearchValue('');
            setBestsellerDaysValue(String(DEFAULT_BESTSELLER_DAYS));
            setPopularDaysValue(String(DEFAULT_POPULAR_DAYS));
            router.push(
              buildUrl({
                kind: '',
                brandId: '',
                q: '',
                bestsellerDays: String(DEFAULT_BESTSELLER_DAYS),
                popularDays: String(DEFAULT_POPULAR_DAYS),
                offset: '',
              })
            );
          }}
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}

      <form onSubmit={handleWindowDaysSubmit} className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={365}
          value={bestsellerDaysValue}
          onChange={(e) => setBestsellerDaysValue(e.target.value)}
          className="h-8 w-[92px]"
          aria-label="Bestseller days"
          placeholder="Best days"
        />
        <Input
          type="number"
          min={1}
          max={365}
          value={popularDaysValue}
          onChange={(e) => setPopularDaysValue(e.target.value)}
          className="h-8 w-[92px]"
          aria-label="Popular days"
          placeholder="Pop days"
        />
        <Button type="submit" size="sm" className="h-8" disabled={isPending}>
          Apply days
        </Button>
      </form>
    </div>
  );
}
