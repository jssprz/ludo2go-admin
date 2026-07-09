'use client';

import {
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  Table
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ProductRow } from './product-row';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectProduct } from './product-row';
import { SortableProductColumn, SortOrder } from '@/lib/db';
import { useTranslations } from 'next-intl';

interface SortableHeaderProps {
  label: string;
  column: SortableProductColumn;
  currentSortBy: SortableProductColumn;
  currentSortOrder: SortOrder;
  className?: string;
  onSort: (column: SortableProductColumn, order: SortOrder) => void;
}

function SortableHeader({ label, column, currentSortBy, currentSortOrder, className, onSort }: SortableHeaderProps) {
  const isActive = currentSortBy === column;
  const nextOrder: SortOrder = isActive && currentSortOrder === 'asc' ? 'desc' : 'asc';

  return (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 whitespace-nowrap hover:text-foreground transition-colors"
        onClick={() => onSort(column, nextOrder)}
      >
        {label}
        {isActive ? (
          currentSortOrder === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 text-foreground" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 text-foreground" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
        )}
      </button>
    </TableHead>
  );
}

export function ProductsTable({
  products,
  offset,
  totalProducts,
  q,
  status,
  sortBy,
  sortOrder,
  currentKind,
  currentBrandId,
}: {
  products: SelectProduct[];
  offset: number;
  totalProducts: number;
  q: string;
  status?: string;
  sortBy: SortableProductColumn;
  sortOrder: SortOrder;
  currentKind: string;
  currentBrandId: string;
}) {
  let router = useRouter();
  let productsPerPage = 10;
  const t = useTranslations('productsTable');
  const tc = useTranslations('common');

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams({
      q,
      status: status ?? 'all',
      sortBy,
      sortOrder,
      kind: currentKind,
      brandId: currentBrandId,
    });
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    }
    // Remove empty params
    for (const [key, value] of Array.from(params.entries())) {
      if (!value) params.delete(key);
    }
    return `/products?${params.toString()}`;
  }

  function prevPage() {
    router.back();
  }

  function nextPage() {
    router.push(buildUrl({ offset }), { scroll: false });
  }

  function handleSort(column: SortableProductColumn, order: SortOrder) {
    router.push(buildUrl({ sortBy: column, sortOrder: order, offset: 0 }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-[100px] sm:table-cell">
                <span className="sr-only">{t('image')}</span>
              </TableHead>
              <SortableHeader
                label={t('name')}
                column="name"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label={t('bggId')}
                column="bggId"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <SortableHeader
                label={t('status')}
                column="status"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label={t('kind')}
                column="kind"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <SortableHeader
                label={t('brand')}
                column="brand"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <SortableHeader
                label={t('variants')}
                column="variants"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <SortableHeader
                label={t('productViews')}
                column="views"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden sm:table-cell"
                onSort={handleSort}
              />
              <SortableHeader
                label={t('productViewsLast7d')}
                column="viewsLast7d"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden sm:table-cell"
                onSort={handleSort}
              />
              <SortableHeader
                label={t('stock')}
                column="stock"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <SortableHeader
                label={t('createdAt')}
                column="createdAt"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <TableHead className="hidden lg:table-cell">{t('createdBy')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('updatedBy')}</TableHead>
              <TableHead>
                <span className="sr-only">{tc('actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <form className="flex items-center w-full justify-between">
          <div className="text-xs text-muted-foreground">
            {t('showing', {
              start: Math.min(offset - products.length + 1, totalProducts),
              end: Math.min(offset, totalProducts),
              total: totalProducts,
            })}
          </div>
          <div className="flex">
            <Button
              formAction={prevPage}
              variant="ghost"
              size="sm"
              type="submit"
              disabled={offset === productsPerPage}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              {tc('previous')}
            </Button>
            <Button
              formAction={nextPage}
              variant="ghost"
              size="sm"
              type="submit"
              disabled={offset >= totalProducts}
            >
              {tc('next')}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardFooter>
    </Card>
  );
}
