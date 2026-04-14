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
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(column, nextOrder)}
      >
        {label}
        {isActive ? (
          currentSortOrder === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
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
        <CardTitle>Products</CardTitle>
        <CardDescription>
          Manage your products and view their sales performance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-[100px] sm:table-cell">
                <span className="sr-only">Image</span>
              </TableHead>
              <SortableHeader
                label="Name"
                column="name"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="Status"
                column="status"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="Kind"
                column="kind"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <SortableHeader
                label="Variants"
                column="variants"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <TableHead className="hidden md:table-cell">
                Total Sales
              </TableHead>
              <SortableHeader
                label="Stock"
                column="stock"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <SortableHeader
                label="Created at"
                column="createdAt"
                currentSortBy={sortBy}
                currentSortOrder={sortOrder}
                className="hidden md:table-cell"
                onSort={handleSort}
              />
              <TableHead>
                <span className="sr-only">Actions</span>
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
            Showing{' '}
            <strong>
              {Math.min(offset - products.length + 1, totalProducts)} - {Math.min(offset, totalProducts)}
            </strong>{' '}
            of <strong>{totalProducts}</strong> products
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
              Prev
            </Button>
            <Button
              formAction={nextPage}
              variant="ghost"
              size="sm"
              type="submit"
              disabled={offset >= totalProducts}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardFooter>
    </Card>
  );
}
