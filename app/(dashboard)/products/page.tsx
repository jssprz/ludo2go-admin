import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { File, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductsTable } from './products-table';
import { getProducts, getAllBrands, SortableProductColumn, SortOrder } from '@/lib/db';
import { ProductStatus, ProductKind } from '@prisma/client';
import { GoogleMerchantSyncButton } from './google-merchant-sync-button';
import { ProductFiltersBar } from './product-filters';

type StatusTab = 'all' | 'active' | 'draft' | 'archived';

const VALID_SORT_COLUMNS: SortableProductColumn[] = [
  'name', 'status', 'kind', 'createdAt', 'updatedAt', 'variants', 'stock'
];

function mapStatusTabToPrisma(
  tab?: string
): ProductStatus | undefined {
  switch (tab) {
    case 'active':
      return ProductStatus.active;
    case 'draft':
      return ProductStatus.draft;
    case 'archived':
      return ProductStatus.archived;
    default:
      return undefined;
  }
}

function isValidKind(value?: string): ProductKind | undefined {
  if (!value) return undefined;
  const kinds = Object.values(ProductKind);
  return kinds.includes(value as ProductKind) ? (value as ProductKind) : undefined;
}

export default async function ProductsPage(
  props: {
    searchParams: Promise<{
      q: string;
      offset: string;
      status?: string;
      sortBy?: string;
      sortOrder?: string;
      kind?: string;
      brandId?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const search = searchParams.q ?? '';
  const offset = searchParams.offset ?? 0;
  const tabStatus: StatusTab = (searchParams.status as StatusTab) ?? 'all';
  const prismaStatus = mapStatusTabToPrisma(searchParams.status);

  // Sorting
  const sortBy: SortableProductColumn =
    VALID_SORT_COLUMNS.includes(searchParams.sortBy as SortableProductColumn)
      ? (searchParams.sortBy as SortableProductColumn)
      : 'createdAt';
  const sortOrder: SortOrder =
    searchParams.sortOrder === 'asc' ? 'asc' : 'desc';

  // Filtering
  const kind = isValidKind(searchParams.kind);
  const brandId = searchParams.brandId || undefined;

  const [{ products, newOffset, totalProducts }, brands] = await Promise.all([
    getProducts(search, Number(offset), prismaStatus, sortBy, sortOrder, { kind, brandId }),
    getAllBrands(),
  ]);

  return (
    <Tabs defaultValue="all" value={tabStatus}>
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="all" asChild>
            <Link
              href={{
                pathname: '/products',
                query: { q: search, status: 'all', sortBy, sortOrder, kind: searchParams.kind ?? '', brandId: searchParams.brandId ?? '' },
              }}
            >
              All
            </Link>
          </TabsTrigger>
          <TabsTrigger value="active" asChild>
            <Link
              href={{
                pathname: '/products',
                query: { q: search, status: 'active', sortBy, sortOrder, kind: searchParams.kind ?? '', brandId: searchParams.brandId ?? '' },
              }}
            >
              Active
            </Link>
          </TabsTrigger>
          <TabsTrigger value="draft" asChild>
            <Link
              href={{
                pathname: '/products',
                query: { q: search, status: 'draft', sortBy, sortOrder, kind: searchParams.kind ?? '', brandId: searchParams.brandId ?? '' },
              }}
            >
              Draft
            </Link>
          </TabsTrigger>
          <TabsTrigger value="archived" className="hidden sm:flex" asChild>
            <Link
              href={{
                pathname: '/products',
                query: { q: search, status: 'archived', sortBy, sortOrder, kind: searchParams.kind ?? '', brandId: searchParams.brandId ?? '' },
              }}
            >
              Archived
            </Link>
          </TabsTrigger>
        </TabsList>
        <div className="ml-auto flex items-center gap-2">
          <GoogleMerchantSyncButton />
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Export
            </span>
          </Button>
          <Button asChild>
            <Link href="/products/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>
      <ProductFiltersBar
        brands={brands}
        currentKind={searchParams.kind ?? ''}
        currentBrandId={searchParams.brandId ?? ''}
        currentSearch={search}
        currentStatus={tabStatus}
        currentSortBy={sortBy}
        currentSortOrder={sortOrder}
      />
      <TabsContent value={tabStatus}>
        <ProductsTable
          products={products}
          offset={newOffset ?? 0}
          totalProducts={totalProducts}
          q={search}
          status={searchParams.status}
          sortBy={sortBy}
          sortOrder={sortOrder}
          currentKind={searchParams.kind ?? ''}
          currentBrandId={searchParams.brandId ?? ''}
        />
      </TabsContent>
    </Tabs>
  );
}