'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  ScanSearch,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useTimeZone } from '@/components/timezone-provider';

type Supplier = {
  id: string;
  name: string;
  kind: string | null;
  configured: boolean;
  status: string;
};
type Variant = { id: string; sku: string; name: string };
type Product = {
  supplierProductId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  url: string | null;
  categories: string[];
  availability: string | null;
  purchasePrice: number | null;
  currency: string | null;
  taxTreatment: string | null;
  taxVerified: boolean;
  packQuantity: number | null;
  edition: string | null;
  language: string | null;
  expansion: boolean | null;
  collectedAt: string;
  match: { variantId: string | null; method: string; requiresReview: boolean };
  external: {
    storeName: string;
    url: string | null;
    availability: string | null;
    checkedAt: string;
  }[];
  opportunity: boolean;
};
type Run = {
  id: string;
  supplierId: string;
  supplierName: string;
  collectedAt: string;
  status: 'running' | 'staged' | 'rejected' | 'failed';
  errors: string[];
  flags: string[];
  approvedAt?: string;
  approvedBy?: string;
  products: Product[];
};
type Snapshot = { suppliers: Supplier[]; variants: Variant[]; runs: Run[] };
type Row = { run: Run; product: Product };
type View = 'opportunities' | 'all' | 'linked' | 'new' | 'review';
type CompetitorCheck = {
  checkedAt: string;
  opportunity: boolean;
  stores: { storeId: string; storeName: string; url: string; availability: string }[];
};
const reviewFields = [
  'edition',
  'language',
  'expansion',
  'packQuantity'
] as const;
type ReviewField = (typeof reviewFields)[number];

async function getSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  const response = await fetch('/api/opportunities', {
    cache: 'no-store',
    signal
  });
  if (!response.ok) throw new Error('load');
  const data = await response.json();
  if (
    !Array.isArray(data.suppliers) ||
    !Array.isArray(data.variants) ||
    !Array.isArray(data.runs)
  ) {
    throw new Error('load');
  }
  return data;
}

function sourceUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function SourceLink({
  url,
  children
}: {
  url: string | null;
  children: React.ReactNode;
}) {
  const href = sourceUrl(url);
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline break-words"
    >
      {children}
      <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
    </a>
  ) : (
    <span>{children}</span>
  );
}

export default function OpportunitiesClient() {
  const t = useTranslations('opportunities');
  const common = useTranslations('common');
  const locale = useLocale();
  const { timeZone } = useTimeZone();
  const [data, setData] = useState<Snapshot>({
    suppliers: [],
    variants: [],
    runs: []
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState('all');
  const [view, setView] = useState<View>('opportunities');
  const [query, setQuery] = useState('');
  const [competitors, setCompetitors] = useState<Record<string, CompetitorCheck>>({});
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [review, setReview] = useState<Row | null>(null);
  const [approval, setApproval] = useState<Run | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [variantId, setVariantId] = useState('');
  const [checks, setChecks] = useState<Partial<Record<ReviewField, boolean>>>(
    {}
  );

  useEffect(() => {
    const controller = new AbortController();
    getSnapshot(controller.signal)
      .then((snapshot) => {
        if (!controller.signal.aborted) setData(snapshot);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setData(await getSnapshot());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function mutate(
    method: 'POST' | 'PATCH',
    body: object,
    key: string,
    completion: 'scanComplete' | 'mappingSaved' | 'runApproved' = method ===
    'POST'
      ? 'scanComplete'
      : 'mappingSaved'
  ) {
    if (pending || loading || loadError) return;
    setPending(key);
    setActionError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/opportunities', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        setActionError(
          typeof failure?.error === 'string'
            ? statusLabel(failure.error)
            : t('actionError')
        );
        return;
      }
      if (completion === 'mappingSaved') setReview(null);
      if (completion === 'runApproved') setApproval(null);
      setNotice(t(completion));
      await refresh();
    } catch {
      setActionError(t('actionError'));
    } finally {
      setPending(null);
    }
  }

  const rowKey = (run: Run, product: Product) =>
    `${run.id}:${product.supplierProductId}`;
  const isNewProduct = (product: Product) =>
    product.availability === 'in_stock' && !product.match.variantId;

  async function checkCompetitors(targets: Row[]) {
    const pendingRows = targets.filter(
      ({ run, product }) =>
        isNewProduct(product) && !checking.has(rowKey(run, product))
    );
    if (!pendingRows.length) return;
    setActionError(null);
    setChecking((current) => {
      const next = new Set(current);
      pendingRows.forEach(({ run, product }) => next.add(rowKey(run, product)));
      return next;
    });
    const bySupplier = new Map<string, Row[]>();
    for (const row of pendingRows)
      bySupplier.set(row.run.supplierId, [
        ...(bySupplier.get(row.run.supplierId) ?? []),
        row
      ]);
    for (const [supplier, group] of Array.from(bySupplier.entries())) {
      for (let index = 0; index < group.length; index += 10) {
        const batch = group.slice(index, index + 10);
        try {
          const response = await fetch('/api/opportunities/competitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supplierId: supplier,
              supplierProductIds: batch.map(
                ({ product }) => product.supplierProductId
              )
            })
          });
          if (!response.ok) throw new Error('check');
          const { checks } = (await response.json()) as {
            checks: (CompetitorCheck & { supplierProductId: string })[];
          };
          setCompetitors((current) => {
            const next = { ...current };
            for (const check of checks) {
              const row = batch.find(
                ({ product }) =>
                  product.supplierProductId === check.supplierProductId
              );
              if (row) next[rowKey(row.run, row.product)] = check;
            }
            return next;
          });
        } catch {
          setActionError(t('competitorCheckError'));
        }
        setChecking((current) => {
          const next = new Set(current);
          batch.forEach(({ run, product }) =>
            next.delete(rowKey(run, product))
          );
          return next;
        });
      }
    }
  }

  function timestamp(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? t('unknown')
      : date.toLocaleString(locale, { timeZone });
  }

  function flagLabel(flag: string) {
    if (flag === 'baseline_review_required') return t('baselineReviewRequired');
    if (flag === 'price_changed') return t('priceChanged');
    if (flag === 'product_count_changed') return t('productCountChanged');
    return flag;
  }

  function approvalRequired(run: Run) {
    return (
      run.status === 'staged' &&
      !run.approvedAt &&
      run.flags.some((flag) =>
        [
          'baseline_review_required',
          'price_changed',
          'product_count_changed'
        ].includes(flag)
      )
    );
  }

  function price(product: Product) {
    if (
      product.purchasePrice == null ||
      !Number.isFinite(Number(product.purchasePrice))
    )
      return t('missingPrice');
    const amount = Number(product.purchasePrice);
    if (product.currency) {
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: product.currency
        }).format(amount);
      } catch {}
    }
    return `${new Intl.NumberFormat(locale).format(amount)} (${t('unknownCurrency')})`;
  }

  function detail(product: Product, field: ReviewField) {
    if (field === 'expansion')
      return product.expansion == null
        ? t('unknown')
        : common(product.expansion ? 'yes' : 'no');
    return product[field] == null || product[field] === ''
      ? t('unknown')
      : String(product[field]);
  }

  function statusLabel(status: string) {
    return t.has(`statuses.${status}`) ? t(`statuses.${status}`) : status;
  }

  const blocked = loading || !!pending || loadError;
  const selectedSuppliers = data.suppliers.filter(
    (supplier) => supplierId === 'all' || supplier.id === supplierId
  );
  const runs = data.runs.filter(
    (run) => supplierId === 'all' || run.supplierId === supplierId
  );
  const rows = runs.flatMap((run) =>
    run.products.map((product) => ({ run, product }))
  );
  const needsReview = (product: Product) =>
    product.match.requiresReview || !product.match.variantId;
  const filtered = rows.filter(({ run, product }) => {
    if (
      view === 'opportunities' &&
      !product.opportunity &&
      !competitors[rowKey(run, product)]?.opportunity
    )
      return false;
    if (view === 'new' && !isNewProduct(product)) return false;
    if (view === 'linked' && needsReview(product)) return false;
    if (view === 'review' && !needsReview(product)) return false;
    return [
      product.name,
      product.sku,
      product.barcode,
      run.supplierName,
      ...product.categories
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase(locale)
      .includes(query.trim().toLocaleLowerCase(locale));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const variants = new Map(
    data.variants.map((variant) => [variant.id, variant])
  );

  return (
    <div className="min-w-0 space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || !!pending}
          onClick={() => void refresh()}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {t('refresh')}
        </Button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-2 border-l-2 border-destructive bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {t('loadError')}
        </div>
      )}
      {actionError && !review && !approval && (
        <p role="alert" className="break-words text-sm text-destructive">
          {actionError}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={supplierId}
          onValueChange={(value) => {
            setSupplierId(value);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label={t('supplier')} className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allSuppliers')}</SelectItem>
            {data.suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-0 flex-1 sm:min-w-56">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
          />
          <Input
            aria-label={t('search')}
            placeholder={t('search')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      <section aria-label={t('suppliers')} className="divide-y border-y">
        {selectedSuppliers.map((supplier) => (
          <div
            key={supplier.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium break-words">{supplier.name}</span>
              {supplier.kind && (
                <span className="text-muted-foreground">{supplier.kind}</span>
              )}
              <span className="text-muted-foreground break-words">
                {statusLabel(supplier.status)}
              </span>
              {!supplier.configured &&
                supplier.status !== 'scan_already_running' && (
                  <Badge variant="outline">{t('notConfigured')}</Badge>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <Link href={`/suppliers?integration=${encodeURIComponent(supplier.id)}`} className="text-primary underline" title={t('setupRequired')}>
              {t('manageSuppliers')}
              <span className="sr-only">: {supplier.name}</span>
            </Link>
            <Button
              size="sm"
              variant="outline"
              disabled={blocked || !supplier.configured}
              title={!supplier.configured ? t('setupRequired') : undefined}
              onClick={() =>
                void mutate('POST', { supplierId: supplier.id }, supplier.id)
              }
            >
              {pending === supplier.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="mr-2 h-4 w-4" />
              )}
              {t(pending === supplier.id ? 'scanning' : 'scan')}
              <span className="sr-only">: {supplier.name}</span>
            </Button>
            </div>
          </div>
        ))}
      </section>

      {!loading &&
        !loadError &&
        (data.suppliers.length === 0 ||
          selectedSuppliers.some((supplier) => !supplier.configured)) && (
          <p className="text-sm text-muted-foreground">
            {t('setupRequired')}{' '}
            <Link href="/suppliers" className="text-primary underline">
              {t('manageSuppliers')}
            </Link>
          </p>
        )}

      {runs.length > 0 && (
        <section
          aria-label={t('runIssues')}
          className="space-y-2 border-l-2 border-amber-500 pl-3 text-sm"
        >
          {runs.map((run) => (
            <div key={run.id} className="break-words">
              <p className="font-medium">
                {run.supplierName} · {timestamp(run.collectedAt)} ·{' '}
                {t(run.status)}
              </p>
              {run.errors.length > 0 && (
                <p className="text-destructive">
                  {t('errors')}: {run.errors.join(' · ')}
                </p>
              )}
              {run.flags.length > 0 && (
                <p className="text-muted-foreground">
                  {t('flags')}: {run.flags.map(flagLabel).join(' · ')}
                </p>
              )}
              {run.approvedAt ? (
                <p className="text-muted-foreground">
                  {t('approvedAt', { date: timestamp(run.approvedAt) })}
                </p>
              ) : run.status === 'staged' ? (
                <>
                  <p className="text-muted-foreground">
                    {t(
                      approvalRequired(run) ? 'approvalRequired' : 'notApproved'
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={blocked || run.errors.length > 0}
                    onClick={() => {
                      setApproval(run);
                      setAcknowledged(false);
                      setActionError(null);
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    {t('approveRun')}
                    <span className="sr-only">: {run.supplierName}</span>
                  </Button>
                </>
              ) : null}
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label={t('view')}
          className="flex max-w-full flex-wrap gap-1"
        >
          {(['opportunities', 'all', 'linked', 'new', 'review'] as const).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={view === mode ? 'secondary' : 'ghost'}
              aria-pressed={view === mode}
              onClick={() => {
                setView(mode);
                setPage(1);
              }}
            >
              {t(mode)}
            </Button>
          ))}
        </div>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {t('resultCount', { count: filtered.length })}
        </p>
        {view === 'new' && pageRows.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={blocked || checking.size > 0}
            onClick={() => checkCompetitors(pageRows)}
          >
            {checking.size > 0 ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {t('checkPage')}
          </Button>
        )}
      </div>

      <div className="min-w-0 border-y bg-background" aria-busy={loading}>
        <Table className="min-w-[1100px] [&_td]:p-3 [&_th]:px-3">
          <TableHeader>
            <TableRow>
              {(
                [
                  'product',
                  'supplier',
                  'purchasePrice',
                  'external',
                  'mapping',
                  'collectedAt'
                ] as const
              ).map((column) => (
                <TableHead key={column}>{t(column)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <span role="status" className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {common('loading')}
                  </span>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {loadError
                    ? t('unavailable')
                    : runs.length === 0
                      ? t('noRuns')
                      : rows.length === 0
                        ? t('noProducts')
                        : view === 'opportunities' &&
                            runs.some(approvalRequired)
                          ? t('approvalRequired')
                          : t('noResults')}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map(({ run, product }) => {
                const variant = product.match.variantId
                  ? variants.get(product.match.variantId)
                  : undefined;
                return (
                  <TableRow key={`${run.id}:${product.supplierProductId}`}>
                    <TableCell className="max-w-72 align-top whitespace-normal">
                      <div className="font-medium break-words">
                        <SourceLink url={product.url}>
                          {product.name}
                        </SourceLink>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground break-words">
                        {t('sku')}: {product.sku || t('unknown')} ·{' '}
                        {t('barcode')}: {product.barcode || t('unknown')}
                      </div>
                      {product.categories.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {product.categories.join(' / ')}
                        </p>
                      )}
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {reviewFields.map((field) => (
                          <div key={field}>
                            <dt className="text-muted-foreground">
                              {t(field)}
                            </dt>
                            <dd>{detail(product, field)}</dd>
                          </div>
                        ))}
                      </dl>
                      {product.opportunity && (
                        <Badge variant="secondary" className="mt-2">
                          {t('opportunity')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-40 align-top whitespace-normal">
                      <p className="font-medium">{run.supplierName}</p>
                      <p className="mt-1 text-xs">
                        {product.availability || t('unknown')}
                      </p>
                      <Badge
                        variant={
                          run.status === 'rejected' ? 'destructive' : 'outline'
                        }
                        className="mt-2"
                      >
                        {t(run.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 align-top whitespace-normal">
                      <p className="font-medium tabular-nums">
                        {price(product)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('taxTreatment')}:{' '}
                        {product.taxTreatment || t('unknown')}
                      </p>
                      <p
                        className={
                          product.taxVerified
                            ? 'mt-1 text-xs'
                            : 'mt-1 text-xs text-amber-700 dark:text-amber-400'
                        }
                      >
                        {t(
                          product.taxVerified ? 'taxVerified' : 'taxUnverified'
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-56 align-top whitespace-normal">
                      {isNewProduct(product) ? (
                        <div className="space-y-2 text-xs">
                          {competitors[rowKey(run, product)] ? (
                            <>
                              {competitors[rowKey(run, product)].opportunity && (
                                <Badge>{t('newOpportunity')}</Badge>
                              )}
                              {competitors[rowKey(run, product)].stores.length ===
                              0 ? (
                                <p className="text-muted-foreground">
                                  {t('notFoundInCompetitors')}
                                </p>
                              ) : (
                                <ul className="space-y-2">
                                  {competitors[rowKey(run, product)].stores.map(
                                    (store) => (
                                      <li key={store.storeId}>
                                        <SourceLink url={store.url}>
                                          {store.storeName}
                                        </SourceLink>
                                        <p>{store.availability}</p>
                                      </li>
                                    )
                                  )}
                                </ul>
                              )}
                              <p className="text-muted-foreground">
                                {t('checkedAt')}:{' '}
                                {timestamp(
                                  competitors[rowKey(run, product)].checkedAt
                                )}
                              </p>
                            </>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={checking.has(rowKey(run, product))}
                            onClick={() => checkCompetitors([{ run, product }])}
                          >
                            {checking.has(rowKey(run, product)) ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="mr-2 h-4 w-4" />
                            )}
                            {t('checkCompetitors')}
                          </Button>
                        </div>
                      ) : product.external.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t(
                            product.match.variantId &&
                              !product.match.requiresReview
                              ? 'rescanRequired'
                              : 'noExternal'
                          )}
                        </span>
                      ) : (
                        <ul className="space-y-3">
                          {product.external.map((store, index) => (
                            <li
                              key={`${store.storeName}:${index}`}
                              className="text-xs"
                            >
                              <SourceLink url={store.url}>
                                {store.storeName}
                              </SourceLink>
                              <p>{store.availability || t('unknown')}</p>
                              <p className="text-muted-foreground">
                                {t('checkedAt')}: {timestamp(store.checkedAt)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56 align-top whitespace-normal">
                      {variant ? (
                        <Link
                          href={`/variants/${encodeURIComponent(variant.id)}/edit`}
                          className="text-sm text-primary hover:underline break-words"
                        >
                          {variant.name} · {variant.sku}
                        </Link>
                      ) : (
                        <p className="text-sm">
                          {product.match.variantId || t('unmatched')}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('method')}: {product.match.method || t('unknown')}
                      </p>
                      <p className="mt-1 text-xs">
                        {t(needsReview(product) ? 'needsReview' : 'confirmed')}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={
                          blocked ||
                          run.status !== 'staged' ||
                          data.variants.length === 0
                        }
                        onClick={() => {
                          setReview({ run, product });
                          setVariantId(
                            product.match.variantId &&
                              variants.has(product.match.variantId)
                              ? product.match.variantId
                              : ''
                          );
                          setChecks({});
                          setActionError(null);
                        }}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {t('reviewMapping')}
                      </Button>
                      {data.variants.length === 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('noVariants')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="max-w-44 align-top whitespace-normal text-xs">
                      <time dateTime={product.collectedAt}>
                        {timestamp(product.collectedAt)}
                      </time>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t('rowsPerPage')}</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger aria-label={t('rowsPerPage')} className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span aria-live="polite" className="text-xs text-muted-foreground">
              {t('pageOf', { page: currentPage, pages: pageCount })}
            </span>
            <Button
              size="sm"
              variant="outline"
              aria-label={t('previousPage')}
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={t('nextPage')}
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!approval}
        onOpenChange={(open) => {
          if (!open && !pending) setApproval(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="tracking-normal">
              {t('approveRun')}
            </DialogTitle>
            <DialogDescription className="break-words">
              {approval?.supplierName} ·{' '}
              {approval && timestamp(approval.collectedAt)}
            </DialogDescription>
          </DialogHeader>
          {approval && (
            <>
              <div className="space-y-2 text-sm">
                <p>{t('approvalScope')}</p>
                <p>{t('resultCount', { count: approval.products.length })}</p>
                {approval.flags.length > 0 && (
                  <p className="break-words">
                    {t('flags')}: {approval.flags.map(flagLabel).join(' · ')}
                  </p>
                )}
                <p>
                  {t('taxVerificationState', {
                    verified: approval.products.filter(
                      (product) => product.taxVerified
                    ).length,
                    unverified: approval.products.filter(
                      (product) => !product.taxVerified
                    ).length
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t('costPricesUnchanged')}
                </p>
              </div>
              <div className="flex items-start gap-2 border-y py-3">
                <Checkbox
                  id="approve-run-acknowledgment"
                  className="mt-0.5 shrink-0"
                  checked={acknowledged}
                  disabled={!!pending}
                  onCheckedChange={(checked) =>
                    setAcknowledged(checked === true)
                  }
                />
                <label
                  htmlFor="approve-run-acknowledgment"
                  className="min-w-0 text-sm leading-relaxed"
                >
                  {t('approvalAcknowledgment')}
                </label>
              </div>
              {actionError && (
                <p
                  role="alert"
                  className="break-words text-sm text-destructive"
                >
                  {actionError}
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  disabled={!!pending}
                  onClick={() => setApproval(null)}
                >
                  {common('cancel')}
                </Button>
                <Button
                  disabled={blocked || !acknowledged}
                  onClick={() => {
                    if (!acknowledged) return;
                    void mutate(
                      'PATCH',
                      {
                        supplierId: approval.supplierId,
                        runId: approval.id,
                        approve: true
                      },
                      `approve:${approval.id}`,
                      'runApproved'
                    );
                  }}
                >
                  {pending === `approve:${approval.id}` ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {t(
                    pending === `approve:${approval.id}`
                      ? 'approving'
                      : 'confirmApproval'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !pending) setReview(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="tracking-normal">
              {t('reviewMapping')}
            </DialogTitle>
            <DialogDescription className="break-words">
              {review?.run.supplierName} · {review?.product.name}
            </DialogDescription>
          </DialogHeader>
          {review && (
            <>
              <div className="space-y-2">
                <label
                  htmlFor="opportunity-variant"
                  className="text-sm font-medium"
                >
                  {t('variant')}
                </label>
                <Select
                  value={variantId}
                  disabled={!!pending}
                  onValueChange={(value) => {
                    setVariantId(value);
                    setChecks({});
                  }}
                >
                  <SelectTrigger
                    id="opportunity-variant"
                    className="min-w-0 [&>span]:truncate"
                  >
                    <SelectValue placeholder={t('selectVariant')} />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-4rem)]">
                    {data.variants.map((variant) => (
                      <SelectItem
                        key={variant.id}
                        value={variant.id}
                        className="break-words"
                      >
                        {variant.name} · {variant.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <fieldset
                disabled={!!pending || !variantId}
                className="space-y-3 border-y py-3"
              >
                <legend className="text-sm font-medium">
                  {t('requiredReview')}
                </legend>
                {reviewFields.map((field) => (
                  <div key={field} className="flex items-start gap-2">
                    <Checkbox
                      id={`review-${field}`}
                      checked={checks[field] === true}
                      onCheckedChange={(checked) =>
                        setChecks((previous) => ({
                          ...previous,
                          [field]: checked === true
                        }))
                      }
                    />
                    <label
                      htmlFor={`review-${field}`}
                      className="min-w-0 cursor-pointer text-sm leading-4 break-words"
                    >
                      {t('reviewField', {
                        field: t(field),
                        value: detail(review.product, field)
                      })}
                    </label>
                  </div>
                ))}
              </fieldset>
              {actionError && (
                <p
                  role="alert"
                  className="text-sm text-destructive break-words"
                >
                  {actionError}
                </p>
              )}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  disabled={!!pending}
                  onClick={() => setReview(null)}
                >
                  {common('cancel')}
                </Button>
                <Button
                  disabled={
                    blocked ||
                    !variants.has(variantId) ||
                    !reviewFields.every((field) => checks[field])
                  }
                  onClick={() => {
                    if (
                      variants.has(variantId) &&
                      reviewFields.every((field) => checks[field])
                    )
                      void mutate(
                        'PATCH',
                        {
                          supplierId: review.run.supplierId,
                          supplierProductId: review.product.supplierProductId,
                          variantId,
                          reviewed: true
                        },
                        'mapping'
                      );
                  }}
                >
                  {pending === 'mapping' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {t('confirmMapping')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
