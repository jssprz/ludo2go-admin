'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, Save, X } from 'lucide-react';

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

type VariantPriceRow = {
  id: string;
  sku: string;
  edition: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
  };
  retailPriceId: string | null;
  salePriceId: string | null;
  retailAmount: number | null;
  saleAmount: number | null;
  currency: string;
};

type Props = {
  variants: VariantPriceRow[];
};

type SortKey = 'product' | 'sku' | 'edition' | 'retail' | 'sale' | 'discountPct';

type EditingState = {
  variantId: string;
  retailAmount: string;
  saleAmount: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === 'CLP' ? 'es-CL' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(amount);
}

function getDiscount(retailAmount: number | null, saleAmount: number | null) {
  if (retailAmount == null || saleAmount == null || retailAmount <= 0 || saleAmount >= retailAmount) {
    return { amount: 0, percentage: 0 };
  }

  const amount = retailAmount - saleAmount;
  return {
    amount,
    percentage: (amount / retailAmount) * 100,
  };
}

export function VariantPricesTable({ variants }: Props) {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<SortKey>('product');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [savingVariantId, setSavingVariantId] = useState<string | null>(null);

  function handleSort(col: SortKey) {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortCol(col);
    setSortDir('asc');
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortCol !== col) return <ArrowUpDown className="ml-1 inline-block h-3.5 w-3.5 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="ml-1 inline-block h-3.5 w-3.5" />
      : <ArrowDown className="ml-1 inline-block h-3.5 w-3.5" />;
  }

  const filteredVariants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return variants;

    return variants.filter((variant) => {
      return (
        variant.product.name.toLowerCase().includes(query) ||
        variant.sku.toLowerCase().includes(query) ||
        (variant.edition ?? '').toLowerCase().includes(query)
      );
    });
  }, [variants, searchQuery]);

  const sortedVariants = useMemo(() => {
    const direction = sortDir === 'asc' ? 1 : -1;

    return [...filteredVariants].sort((a, b) => {
      switch (sortCol) {
        case 'product':
          return direction * a.product.name.localeCompare(b.product.name);
        case 'sku':
          return direction * a.sku.localeCompare(b.sku);
        case 'edition':
          return direction * (a.edition ?? '').localeCompare(b.edition ?? '');
        case 'retail':
          return direction * ((a.retailAmount ?? 0) - (b.retailAmount ?? 0));
        case 'sale':
          return direction * ((a.saleAmount ?? 0) - (b.saleAmount ?? 0));
        case 'discountPct': {
          const aDiscount = getDiscount(a.retailAmount, a.saleAmount).percentage;
          const bDiscount = getDiscount(b.retailAmount, b.saleAmount).percentage;
          return direction * (aDiscount - bDiscount);
        }
        default:
          return 0;
      }
    });
  }, [filteredVariants, sortCol, sortDir]);

  const summary = useMemo(() => {
    const base = {
      retailTotal: 0,
      saleTotal: 0,
      discountAmountTotal: 0,
      discountPctTotal: 0,
      retailCount: 0,
      saleCount: 0,
      discountCount: 0,
    };

    const acc = filteredVariants.reduce((current, variant) => {
      if (variant.retailAmount != null) {
        current.retailTotal += variant.retailAmount;
        current.retailCount += 1;
      }

      if (variant.saleAmount != null) {
        current.saleTotal += variant.saleAmount;
        current.saleCount += 1;
      }

      const discount = getDiscount(variant.retailAmount, variant.saleAmount);
      if (discount.amount > 0) {
        current.discountAmountTotal += discount.amount;
        current.discountPctTotal += discount.percentage;
        current.discountCount += 1;
      }

      return current;
    }, base);

    return {
      ...acc,
      retailAverage: acc.retailCount > 0 ? acc.retailTotal / acc.retailCount : 0,
      saleAverage: acc.saleCount > 0 ? acc.saleTotal / acc.saleCount : 0,
      discountAverage: acc.discountCount > 0 ? acc.discountPctTotal / acc.discountCount : 0,
    };
  }, [filteredVariants]);

  function startEditing(variant: VariantPriceRow) {
    setEditing({
      variantId: variant.id,
      retailAmount: variant.retailAmount != null ? String(variant.retailAmount) : '',
      saleAmount: variant.saleAmount != null ? String(variant.saleAmount) : '',
    });
  }

  function cancelEditing() {
    setEditing(null);
  }

  function parseMoneyInput(value: string): number | null {
    const normalized = value.trim();
    if (!normalized) return null;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return null;

    return Math.round(parsed);
  }

  async function saveRow(variant: VariantPriceRow) {
    if (!editing || editing.variantId !== variant.id) return;

    const retailAmount = parseMoneyInput(editing.retailAmount);
    const saleAmount = parseMoneyInput(editing.saleAmount);

    if (retailAmount == null) {
      alert('Retail price is required and must be a valid non-negative number.');
      return;
    }

    if (saleAmount != null && saleAmount > retailAmount) {
      alert('Sale price cannot be greater than retail price.');
      return;
    }

    setSavingVariantId(variant.id);

    try {
      const res = await fetch(`/api/variant-prices/${variant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retailAmount,
          saleAmount,
          currency: variant.currency,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to update prices');
      }

      setEditing(null);
      router.refresh();
    } catch (error: any) {
      alert(error?.message || 'Unexpected error while updating prices');
    } finally {
      setSavingVariantId(null);
    }
  }

  if (variants.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No variants found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Retail</p>
          <p className="text-lg font-semibold">{formatMoney(summary.retailTotal, 'CLP')}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Avg Retail</p>
          <p className="text-lg font-semibold">{formatMoney(summary.retailAverage, 'CLP')}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Sale</p>
          <p className="text-lg font-semibold">{formatMoney(summary.saleTotal, 'CLP')}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Avg Sale</p>
          <p className="text-lg font-semibold">{formatMoney(summary.saleAverage, 'CLP')}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Total Discount</p>
          <p className="text-lg font-semibold text-emerald-700">
            {formatMoney(summary.discountAmountTotal, 'CLP')}
          </p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Avg Discount</p>
          <p className="text-lg font-semibold text-emerald-700">{summary.discountAverage.toFixed(2)}%</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by product, SKU, or edition"
          className="max-w-md"
        />
        <p className="text-sm text-muted-foreground">
          Showing {filteredVariants.length} of {variants.length} variants
        </p>
      </div>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('product')}>
                Product <SortIcon col="product" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('sku')}>
                SKU <SortIcon col="sku" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('edition')}>
                Edition <SortIcon col="edition" />
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('retail')}>
                Retail <SortIcon col="retail" />
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('sale')}>
                Sale <SortIcon col="sale" />
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('discountPct')}>
                Discount <SortIcon col="discountPct" />
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedVariants.map((variant) => {
              const rowEditing = editing?.variantId === variant.id;
              const retailAmount = rowEditing ? parseMoneyInput(editing.retailAmount) : variant.retailAmount;
              const saleAmount = rowEditing ? parseMoneyInput(editing.saleAmount) : variant.saleAmount;
              const discount = getDiscount(retailAmount, saleAmount);

              return (
                <TableRow key={variant.id}>
                  <TableCell>
                    <Link
                      href={`/products/${variant.product.id}/edit`}
                      className="font-medium hover:underline"
                    >
                      {variant.product.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{variant.sku}</TableCell>
                  <TableCell>{variant.edition || '-'}</TableCell>
                  <TableCell className="text-right">
                    {rowEditing && editing ? (
                      <Input
                        type="number"
                        min="0"
                        value={editing.retailAmount}
                        onChange={(event) =>
                          setEditing((prev) =>
                            prev && prev.variantId === variant.id
                              ? { ...prev, retailAmount: event.target.value }
                              : prev
                          )
                        }
                        className="ml-auto w-32 text-right"
                        autoFocus
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditing(variant)}
                        className="hover:underline"
                      >
                        {variant.retailAmount != null ? formatMoney(variant.retailAmount, variant.currency) : '-'}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {rowEditing && editing ? (
                      <Input
                        type="number"
                        min="0"
                        value={editing.saleAmount}
                        onChange={(event) =>
                          setEditing((prev) =>
                            prev && prev.variantId === variant.id
                              ? { ...prev, saleAmount: event.target.value }
                              : prev
                          )
                        }
                        className="ml-auto w-32 text-right"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditing(variant)}
                        className="hover:underline"
                      >
                        {variant.saleAmount != null ? formatMoney(variant.saleAmount, variant.currency) : '-'}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {discount.percentage > 0 ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {discount.percentage.toFixed(2)}% ({formatMoney(discount.amount, variant.currency)})
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {rowEditing ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          onClick={() => saveRow(variant)}
                          disabled={savingVariantId === variant.id}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                          disabled={savingVariantId === variant.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/variants/${variant.id}/edit`}>View</Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {sortedVariants.length > 0 && (
              <TableRow className="border-t-2 border-t-border bg-muted/50 font-semibold">
                <TableCell colSpan={3}>Total / Average</TableCell>
                <TableCell className="text-right">
                  {formatMoney(summary.retailTotal, 'CLP')} / {formatMoney(summary.retailAverage, 'CLP')}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(summary.saleTotal, 'CLP')} / {formatMoney(summary.saleAverage, 'CLP')}
                </TableCell>
                <TableCell className="text-right">
                  {summary.discountAverage.toFixed(2)}% ({formatMoney(summary.discountAmountTotal, 'CLP')})
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filteredVariants.length === 0 && searchQuery && (
        <p className="py-4 text-center text-muted-foreground">
          No variants found matching "{searchQuery}"
        </p>
      )}
    </div>
  );
}
