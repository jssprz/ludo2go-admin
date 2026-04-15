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
  RefreshCcw,
  Loader2,
  ExternalLink,
  TrendingUp,
  AlertCircle,
  ImageOff,
} from 'lucide-react';

interface TrendingProduct {
  rank: number;
  name: string;
  url: string;
  imageUrl: string | null;
  price: number | null;
  originalPrice: number | null;
  currency: string;
  badge: string | null;
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

function TrendingStoreCard({ source }: { source: TrendingSource }) {
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
        ) : source.products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No products found. The page structure may have changed.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right hidden sm:table-cell">
                  Original
                </TableHead>
                <TableHead className="hidden md:table-cell">Badge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {source.products.map((p) => {
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
