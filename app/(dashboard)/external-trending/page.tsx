'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  RefreshCcw,
  Loader2,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  ImageOff,
  CheckCircle2,
  Circle,
} from 'lucide-react';

interface CatalogStatus {
  inCatalog: boolean;
  variantId?: string;
  variantSku?: string;
  productName?: string;
  loading?: boolean;
  error?: string;
}

interface TrendingProduct {
  rank: number;
  name: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  originalPrice: number | null;
  currency: string;
  badge: string | null;
  brand?: string | null;
  catalogStatus?: CatalogStatus;
}

interface TrendingSource {
  key: string;
  storeName: string;
  url: string;
  products: TrendingProduct[];
  scrapedAt: string;
  error?: string;
}

function formatPrice(amount: number | null, currency: string): string {
  if (amount === null) return '—';
  return `$${amount.toLocaleString('es-CL')}`;
}

function getTimeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function checkProductCatalogStatus(
  url: string,
  storeKey: string
): Promise<CatalogStatus> {
  try {
    const res = await fetch('/api/trending/check-catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, storeKey }),
    });

    if (!res.ok) {
      return {
        inCatalog: false,
        error: 'Failed to check',
      };
    }

    return await res.json();
  } catch (error) {
    console.error('Error checking catalog:', error);
    return {
      inCatalog: false,
      error: 'Error',
    };
  }
}

function CatalogStatusBadge({ status }: { status: CatalogStatus | undefined }) {
  if (!status) return null;

  if (status.error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Circle className="h-3 w-3" />
        <span>{status.error}</span>
      </div>
    );
  }

  if (status.inCatalog) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-xs font-medium text-green-600">In Catalog</span>
        </div>
        {status.variantSku && (
          <div className="text-xs text-muted-foreground">SKU: {status.variantSku}</div>
        )}
        {status.productName && (
          <div className="text-xs text-muted-foreground line-clamp-1">
            {status.productName}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Circle className="h-3 w-3" />
      <span>Not in catalog</span>
    </div>
  );
}

function TrendingStoreCard({ source }: { source: TrendingSource }) {
  const [products, setProducts] = useState<TrendingProduct[]>(source.products);
  const [isCheckingCatalog, setIsCheckingCatalog] = useState(false);
  const [brandFilter, setBrandFilter] = useState('all');

  const unbrandedValue = '__no_brand__';
  const brandOptions = Array.from(
    new Set(products.map((p) => p.brand?.trim()).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));

  const filteredProducts = products.filter((p) => {
    if (brandFilter === 'all') return true;
    if (brandFilter === unbrandedValue) return !p.brand?.trim();
    return p.brand?.trim() === brandFilter;
  });

  // Fetch catalog status for all products in this store
  useEffect(() => {
    async function fetchCatalogStatuses() {
      setIsCheckingCatalog(true);
      const updatedProducts = await Promise.all(
        products.map(async (product) => ({
          ...product,
          catalogStatus: {
            inCatalog: false,
            loading: true,
          },
        }))
      );
      setProducts(updatedProducts);

      // Now fetch actual status for each product
      const finalProducts = await Promise.all(
        updatedProducts.map(async (product) => {
          const status = await checkProductCatalogStatus(product.url, source.storeName);
          return {
            ...product,
            catalogStatus: status,
          };
        })
      );
      setProducts(finalProducts);
      setIsCheckingCatalog(false);
    }

    if (products.length > 0) {
      fetchCatalogStatuses();
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              {source.storeName}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>Top sellers by sales volume</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="text-xs">{getTimeSince(source.scrapedAt)}</span>
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Visit
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {source.error ? (
          <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Failed to scrape: {source.error}</span>
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No products found. The page structure may have changed.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                Showing {filteredProducts.length} of {products.length} products
              </div>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter by brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {brandOptions.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                  <SelectItem value={unbrandedValue}>No brand</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products match the selected brand.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="w-16">Image</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="hidden lg:table-cell">Brand</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">
                      Original
                    </TableHead>
                    <TableHead className="hidden md:table-cell">Badge</TableHead>
                    <TableHead>Catalog Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((p) => {
                    const hasDiscount =
                      p.originalPrice !== null &&
                      p.price !== null &&
                      p.originalPrice > p.price;
                    const discountPct = hasDiscount
                      ? Math.round(
                          ((p.originalPrice! - p.price!) / p.originalPrice!) * 100
                        )
                      : null;

                    return (
                      <TableRow key={`${source.key}-${p.rank}`}>
                        <TableCell className="font-mono text-muted-foreground text-sm">
                          {p.rank}
                        </TableCell>
                        <TableCell>
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              width={48}
                              height={48}
                              className="rounded object-cover aspect-square w-12 h-12"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                              <ImageOff className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:underline hover:text-primary transition-colors line-clamp-2"
                          >
                            {p.name}
                          </a>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {p.brand ? (
                            <span className="text-sm text-muted-foreground">{p.brand}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`text-sm font-medium tabular-nums ${
                              hasDiscount ? 'text-green-600' : ''
                            }`}
                          >
                            {formatPrice(p.price, p.currency)}
                          </span>
                          {discountPct !== null && (
                            <Badge
                              variant="destructive"
                              className="ml-1.5 text-[10px] px-1 py-0"
                            >
                              -{discountPct}%
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          {hasDiscount ? (
                            <span className="text-sm text-muted-foreground line-through tabular-nums">
                              {formatPrice(p.originalPrice, p.currency)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {p.badge ? (
                            <Badge variant="secondary" className="text-xs">
                              {p.badge}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {p.catalogStatus?.loading ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Checking…</span>
                            </div>
                          ) : (
                            <CatalogStatusBadge status={p.catalogStatus} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ExternalTrendingPage() {
  const [sources, setSources] = useState<TrendingSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTrending() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trending');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TrendingSource[] = await res.json();
      setSources(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch trending data');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTrending();
  }, []);

  const totalProducts = sources.reduce((s, src) => s + src.products.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-orange-500" />
            External Trending
          </h1>
          <p className="text-muted-foreground">
            Best-selling board games from competitor stores, sorted by sales volume.
          </p>
        </div>
        <Button
          onClick={fetchTrending}
          disabled={isLoading}
          variant="outline"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCcw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Summary */}
      {!isLoading && !error && (
        <div className="flex gap-4 flex-wrap">
          <Card className="flex-1 min-w-[150px]">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{sources.length}</div>
              <p className="text-xs text-muted-foreground">Stores scraped</p>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[150px]">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{totalProducts}</div>
              <p className="text-xs text-muted-foreground">Products found</p>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-[150px]">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {sources.filter((s) => s.error).length === 0 ? (
                  <span className="text-green-600">All OK</span>
                ) : (
                  <span className="text-red-500">
                    {sources.filter((s) => s.error).length} errors
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Scrape status</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Scraping competitor stores… This may take a few seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-red-500">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Store cards */}
      {!isLoading &&
        sources.map((source) => (
          <TrendingStoreCard key={source.key} source={source} />
        ))}
    </div>
  );
}
