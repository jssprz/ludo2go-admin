import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { File, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductsTable } from './products-table';
import { getProducts } from '@/lib/db';
import { ProductStatus } from '@prisma/client'

type StatusTab = 'all' | 'active' | 'draft' | 'archived';

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
      // 'all' or anything unknown => no filter
      return undefined;
  }
}

export default async function ProductsPage(
  props: {
    searchParams: Promise<{ q: string; offset: string; status?: string; }>;
  }
) {
  const searchParams = await props.searchParams;
  const search = searchParams.q ?? '';
  const offset = searchParams.offset ?? 0;
  const tabStatus: StatusTab = (searchParams.status as StatusTab) ?? 'all';
  const prismaStatus = mapStatusTabToPrisma(searchParams.status);
  const { products, newOffset, totalProducts } = await getProducts(
    search,
    Number(offset),
    prismaStatus
  );

  return (
    <Tabs defaultValue="all" value={tabStatus}>
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="all" asChild>
            <Link
              href={{
                pathname: '/products',
                query: { q: search, status: 'all' },
              }}
            >
              All
            </Link>
          </TabsTrigger>
          <TabsTrigger value="active" asChild>
            <Link
              href={{
                pathname: '/products',
                query: { q: search, status: 'active' },
              }}
            >
              Active
            </Link>
          </TabsTrigger>
          <TabsTrigger value="draft" asChild>
            <Link
              href={{
                pathname: '/products',
                query: { q: search, status: 'draft' },
              }}
            >
              Draft
            </Link>
          </TabsTrigger>
          <TabsTrigger value="archived" className="hidden sm:flex" asChild>
            <Link
              href={{
                pathname: '/products',
                query: { q: search, status: 'archived' },
              }}
            >
              Archived
            </Link>
          </TabsTrigger>
        </TabsList>
        <div className="ml-auto flex items-center gap-2">
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
      <TabsContent value={tabStatus}>
        <ProductsTable
          products={products}
          offset={newOffset ?? 0}
          totalProducts={totalProducts}
          q={search}
          status={searchParams.status}
        />
      </TabsContent>
    </Tabs>
  );
}