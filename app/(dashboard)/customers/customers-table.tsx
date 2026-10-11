'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  AlertTriangle,
  RotateCcw,
  Columns3,
  Save,
  Pin,
  PinOff,
  Trash2
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import type {
  CustomerListRow,
  CustomerListPage,
  CustomerListQuery,
  CustomerListSort
} from '@/lib/customer-list';
import {
  applyCustomerListView,
  canApplyDefaultView,
  changeCustomerListTab,
  CUSTOMER_LIST_COLUMNS,
  CUSTOMER_LIST_VIEWS,
  normalizeColumns,
  savedCustomerListQuery,
  summarizeCustomerListActivity,
  updateCustomerListUrl,
  type CustomerListColumn
} from './customer-list-ui-state';
import { CreateCustomerDialog } from './create-customer-dialog';
import { DuplicateReview } from './duplicate-review';
import { useCustomerListPreferences } from './use-customer-list-preferences';
import { CartItemsDialog } from './cart-items-dialog';

const sortableColumns = new Set<string>([
  'ltv',
  'orders',
  'lastPurchase',
  'lastActivity',
  'cartValue',
  'risk'
]);
const filterOptions = {
  segment: ['new', 'repeat', 'vip', 'inactive', 'atRisk'],
  activity: ['7', '30', '90', 'inactive'],
  purchase: ['none', 'one', 'repeat'],
  cart: ['active', 'abandoned'],
  risk: ['high', 'insufficient'],
  quality: ['flagged', 'duplicate', 'internal']
} as const;

export function CustomersTable({
  page,
  query
}: {
  page: CustomerListPage | null;
  query: CustomerListQuery;
}) {
  const translate = useTranslations('CustomerList');
  const format = useFormatter();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q);
  const adminId = session?.user?.id;
  const {
    preferences,
    ready: preferencesReady,
    saving: preferencesSaving,
    error: preferenceError,
    legacy: legacyPreferences,
    persist,
    reload: reloadPreferences
  } = useCustomerListPreferences(adminId);
  const appliedDefault = useRef<string | undefined>(undefined);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [nameError, setNameError] = useState(false);
  const paramsText = searchParams.toString();

  useEffect(() => {
    setSearch(query.q);
  }, [query.q]);
  useEffect(() => {
    if (!adminId) {
      appliedDefault.current = undefined;
      return;
    }
    if (!preferencesReady || appliedDefault.current === adminId) return;
    appliedDefault.current = adminId;
    const current = new URLSearchParams(window.location.search);
    const defaultView = preferences.views.find(
      (view) => view.id === preferences.defaultView
    );
    if (defaultView && canApplyDefaultView(current)) {
      startTransition(() =>
        router.replace(
          `/customers?${applyCustomerListView(current, defaultView.query, defaultView.id, true)}`,
          { scroll: false }
        )
      );
    }
  }, [adminId, preferencesReady, preferences, router]);

  const navigate = (params: URLSearchParams) =>
    startTransition(() =>
      router.push(`/customers?${params}`, { scroll: false })
    );
  const update = (changes: Record<string, string | null>, reset = true) => {
    const current = new URLSearchParams(paramsText);
    if (query.view && changes.view === null) {
      Object.keys(filterOptions).forEach((key) => {
        const value = query[key as keyof CustomerListQuery];
        if (typeof value === 'string') current.set(key, value);
      });
    }
    navigate(updateCustomerListUrl(current, changes, reset));
  };
  const columnsParam = searchParams.get('columns');
  const columns =
    columnsParam !== null
      ? normalizeColumns(columnsParam.split(','))
      : normalizeColumns(preferences.columns);
  const count =
    query.tab === 'customers'
      ? (page?.customers.length ?? 0)
      : (page?.visitors.length ?? 0);
  const activeSavedView = preferences.views.find(
    (view) => view.id === searchParams.get('savedView')
  );
  const date = (value: string | null) =>
    value
      ? format.dateTime(new Date(value), {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      : translate('unknown');
  const money = (value: number, currency: string) =>
    format.number(value, { style: 'currency', currency });
  const sortHeader = (column: CustomerListSort, label: string) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3"
      disabled={pending}
      onClick={() =>
        update({
          sort: column,
          order:
            query.sort === column && query.order === 'desc' ? 'asc' : 'desc',
          savedView: null
        })
      }
      aria-label={translate('sortBy', { column: label })}
    >
      {label}
      {query.sort !== column ? (
        <ArrowUpDown className="ml-1 h-3 w-3" />
      ) : query.order === 'asc' ? (
        <ArrowUp className="ml-1 h-3 w-3" />
      ) : (
        <ArrowDown className="ml-1 h-3 w-3" />
      )}
    </Button>
  );
  const activity = (summary: Record<string, number>) => {
    const { entries, remaining } = summarizeCustomerListActivity(summary);
    return entries.length ? (
      <div className="line-clamp-2 max-w-[240px] text-xs">
        {entries
          .map(([event, amount]) =>
            translate('activityEntry', {
              label: translate.has(`events.${event}`)
                ? translate(`events.${event}`)
                : translate('otherEvent'),
              count: amount
            })
          )
          .join(' · ')}
        {remaining > 0 && ` · ${translate('moreEvents', { count: remaining })}`}
      </div>
    ) : (
      translate('noActivity')
    );
  };
  const cell = (customer: CustomerListRow, column: CustomerListColumn) => {
    switch (column) {
      case 'segment':
        return customer.segment ? (
          <Badge variant="secondary">
            {translate(`segments.${customer.segment}`)}
          </Badge>
        ) : (
          translate('unknown')
        );
      case 'ltv':
        return money(customer.ltv, customer.currency);
      case 'orders':
        return (
          <>
            {format.number(customer.ordersCount)}
            <div className="text-xs text-muted-foreground">
              {translate('aov', {
                value: money(customer.aov, customer.currency)
              })}
            </div>
          </>
        );
      case 'lastPurchase':
        return date(customer.lastPurchase);
      case 'lastActivity':
        return date(customer.lastActivity);
      case 'phone':
        return customer.phone ?? translate('unknown');
      case 'joined':
        return date(customer.createdAt);
      case 'activity':
        return activity(customer.activitySummary);
      case 'cartValue':
        return (
          <CartItemsDialog
            ownerType="customer"
            ownerId={customer.id}
            ownerName={customer.name}
            totalLabel={money(customer.cartValue, customer.currency)}
          />
        );
      case 'risk':
        return (
          <Badge variant={customer.risk === 'high' ? 'destructive' : 'outline'}>
            {translate(`risks.${customer.risk}`)}
          </Badge>
        );
      case 'status':
        return (
          <div className="max-w-[240px] space-y-1 text-xs">
            {customer.cartCount > 0 && (
              <div>{translate('filters.cartOptions.active')}</div>
            )}
            {customer.abandoned && (
              <div>{translate('filters.cartOptions.abandoned')}</div>
            )}
            <Badge
              variant={customer.risk === 'high' ? 'destructive' : 'outline'}
            >
              {translate(`risks.${customer.risk}`)}
            </Badge>
          </div>
        );
    }
  };
  const reset = () => {
    setSearch('');
    navigate(new URLSearchParams({ tab: query.tab }));
  };
  return (
    <section
      className="min-w-0 w-full max-w-full space-y-4"
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{translate('title')}</h1>
        <CreateCustomerDialog />
      </div>
      {page && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Object.entries(page.kpis).map(([key, value]) => (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">
                  {translate(`kpis.${key}`)}
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {format.number(value)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <nav className="flex gap-2 border-b" aria-label={translate('title')}>
        {(['customers', 'visitors'] as const).map((tab) => (
          <Button
            key={tab}
            aria-current={query.tab === tab ? 'page' : undefined}
            disabled={pending}
            variant={query.tab === tab ? 'secondary' : 'ghost'}
            onClick={() =>
              navigate(
                changeCustomerListTab(new URLSearchParams(paramsText), tab)
              )
            }
          >
            {translate(tab)}{' '}
            <Badge variant="outline" className="ml-2">
              {page
                ? format.number(
                    tab === 'customers'
                      ? page.totalCustomers
                      : page.totalVisitors
                  )
                : translate('unknown')}
            </Badge>
          </Button>
        ))}
      </nav>
      <form
        className="flex min-w-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: search, savedView: null });
        }}
      >
        <Input
          className="min-w-0 flex-1"
          aria-label={translate(
            query.tab === 'customers' ? 'searchCustomers' : 'searchVisitors'
          )}
          placeholder={translate(
            query.tab === 'customers' ? 'searchCustomers' : 'searchVisitors'
          )}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          <Search className="mr-2 h-4 w-4" />
          {translate('search')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={pending}
          aria-label={translate('reset')}
          title={translate('reset')}
          onClick={reset}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </form>
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        {query.tab === 'customers' && (
          <label className="grid min-w-0 gap-1 text-xs text-muted-foreground">
            {translate('views.label')}
            <select
              className="h-9 max-w-full rounded-md border bg-background px-2 text-sm text-foreground"
              disabled={pending}
              value={
                activeSavedView
                  ? `saved:${activeSavedView.id}`
                  : (query.view ?? '')
              }
              onChange={(event) => {
                const value = event.target.value;
                const saved = preferences.views.find(
                  (view) => `saved:${view.id}` === value
                );
                if (saved)
                  navigate(
                    applyCustomerListView(
                      new URLSearchParams(paramsText),
                      saved.query,
                      saved.id,
                      true
                    )
                  );
                else if (value)
                  navigate(
                    applyCustomerListView(
                      new URLSearchParams(paramsText),
                      {},
                      value
                    )
                  );
                else reset();
              }}
            >
              <option value="">{translate('views.all')}</option>
              <optgroup label={translate('views.builtIn')}>
                {CUSTOMER_LIST_VIEWS.map((view) => (
                  <option key={view} value={view}>
                    {translate(`views.${view}`)}
                  </option>
                ))}
              </optgroup>
              {preferences.views.length > 0 && (
                <optgroup label={translate('views.saved')}>
                  {preferences.views.map((view) => (
                    <option key={view.id} value={`saved:${view.id}`}>
                      {view.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        )}
        {Object.entries(filterOptions)
          .filter(
            ([key]) =>
              query.tab === 'customers' || key === 'activity' || key === 'cart'
          )
          .map(([key, options]) => (
            <label
              key={key}
              className="grid gap-1 text-xs text-muted-foreground"
            >
              {translate(`filters.${key}`)}
              <select
                className="h-9 max-w-[220px] rounded-md border bg-background px-2 text-sm text-foreground"
                disabled={pending}
                value={query[key as keyof CustomerListQuery] ?? ''}
                onChange={(event) =>
                  update({
                    [key]: event.target.value || null,
                    view: null,
                    savedView: null
                  })
                }
              >
                <option value="">{translate('all')}</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {translate(
                      key === 'segment'
                        ? `segments.${option}`
                        : `filters.${key}Options.${option}`
                    )}
                  </option>
                ))}
              </select>
            </label>
          ))}
        {query.tab === 'customers' && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!preferencesReady || preferencesSaving}
                >
                  <Columns3 className="mr-2 h-4 w-4" />
                  {translate('columnsLabel')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {CUSTOMER_LIST_COLUMNS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column}
                    checked={columns.includes(column)}
                    disabled={preferencesSaving}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={async (checked) => {
                      const next = normalizeColumns(
                        checked
                          ? [...columns, column]
                          : columns.filter((entry) => entry !== column)
                      );
                      if (await persist({ ...preferences, columns: next })) {
                        update(
                          {
                            columns: next.join(',') || 'none',
                            savedView: null
                          },
                          false
                        );
                      }
                    }}
                  >
                    {translate(`columns.${column}`)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              disabled={!preferencesReady || preferencesSaving}
              onClick={() => {
                setViewName('');
                setNameError(false);
                setSaveOpen(true);
              }}
            >
              <Save className="mr-2 h-4 w-4" />
              {translate('views.save')}
            </Button>
            {activeSavedView && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!preferencesReady || preferencesSaving}
                  title={translate(
                    preferences.defaultView === activeSavedView.id
                      ? 'views.unpin'
                      : 'views.pin'
                  )}
                  aria-label={translate(
                    preferences.defaultView === activeSavedView.id
                      ? 'views.unpin'
                      : 'views.pin'
                  )}
                  onClick={() =>
                    persist({
                      ...preferences,
                      defaultView:
                        preferences.defaultView === activeSavedView.id
                          ? null
                          : activeSavedView.id
                    })
                  }
                >
                  {preferences.defaultView === activeSavedView.id ? (
                    <PinOff className="h-4 w-4" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!preferencesReady || preferencesSaving}
                  title={translate('views.delete')}
                  aria-label={translate('views.delete')}
                  onClick={async () => {
                    const saved = await persist({
                      ...preferences,
                      views: preferences.views.filter(
                        (view) => view.id !== activeSavedView.id
                      ),
                      defaultView:
                        preferences.defaultView === activeSavedView.id
                          ? null
                          : preferences.defaultView
                    });
                    if (saved) update({ savedView: null }, false);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <DuplicateReview search={query.q} />
          </>
        )}
      </div>
      {preferenceError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-sm text-destructive"
        >
          <span>{translate(`preferences.${preferenceError}`)}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={preferencesSaving}
            onClick={reloadPreferences}
          >
            {translate('preferences.retry')}
          </Button>
        </div>
      )}
      {legacyPreferences && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{translate('preferences.legacyAvailable')}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!preferencesReady || preferencesSaving}
            onClick={() => persist(legacyPreferences)}
          >
            {translate('preferences.import')}
          </Button>
        </div>
      )}
      <div role="status" className="text-sm text-muted-foreground">
        {preferencesSaving
          ? translate('preferences.saving')
          : adminId && !preferencesReady && !preferenceError
            ? translate('preferences.loading')
            : null}
        {pending ? translate('updating') : null}
      </div>
      {!page ? (
        <div role="alert" className="space-y-2 py-8">
          <h2 className="font-semibold">{translate('errorTitle')}</h2>
          <p>{translate('errorDescription')}</p>
          <Button
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            {translate('retry')}
          </Button>
        </div>
      ) : count === 0 ? (
        <div className="space-y-2 py-12 text-center">
          <h2 className="font-semibold">
            {translate(
              (query.tab === 'customers'
                ? page.totalCustomers
                : page.totalVisitors) === 0
                ? query.tab === 'customers'
                  ? 'emptyCustomers'
                  : 'emptyVisitors'
                : 'noResults'
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {translate('noResultsDescription')}
          </p>
          <Button variant="outline" onClick={reset}>
            {translate('reset')}
          </Button>
        </div>
      ) : (
        <div className="min-w-0 w-full max-w-full overflow-x-auto rounded-md border">
          <Table className="w-full min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead
                  aria-sort={
                    query.sort === 'name'
                      ? query.order === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {sortHeader(
                    'name',
                    translate(
                      `columns.${query.tab === 'customers' ? 'customer' : 'visitor'}`
                    )
                  )}
                </TableHead>
                {query.tab === 'customers' ? (
                  columns.map((column) => (
                    <TableHead
                      key={column}
                      aria-sort={
                        query.sort === column
                          ? query.order === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      {sortableColumns.has(column)
                        ? sortHeader(
                            column as CustomerListSort,
                            translate(`columns.${column}`)
                          )
                        : translate(`columns.${column}`)}
                    </TableHead>
                  ))
                ) : (
                  <>
                    <TableHead>{translate('columns.sessions')}</TableHead>
                    <TableHead>{translate('columns.events')}</TableHead>
                    <TableHead>
                      {sortHeader(
                        'lastActivity',
                        translate('columns.lastActivity')
                      )}
                    </TableHead>
                    <TableHead>
                      {sortHeader('cartValue', translate('columns.cartValue'))}
                    </TableHead>
                  </>
                )}
                {query.tab === 'customers' && (
                  <TableHead>
                    <span className="sr-only">
                      {translate('columns.actions')}
                    </span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.tab === 'customers'
                ? page.customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="max-w-[260px]">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="block truncate font-medium hover:underline"
                        >
                          {customer.name}
                        </Link>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="truncate">{customer.email}</span>
                          {customer.quality.length > 0 && (
                            <span
                              title={customer.quality
                                .map((flag) =>
                                  translate(`qualityFlags.${flag}`)
                                )
                                .join(', ')}
                            >
                              <AlertTriangle
                                className="h-3 w-3 shrink-0 text-amber-600"
                                aria-hidden="true"
                              />
                              <span className="sr-only">
                                {customer.quality
                                  .map((flag) =>
                                    translate(`qualityFlags.${flag}`)
                                  )
                                  .join(', ')}
                              </span>
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell
                          key={column}
                          className={
                            column === 'status' || column === 'activity'
                              ? ''
                              : 'whitespace-nowrap tabular-nums'
                          }
                        >
                          {cell(customer, column)}
                        </TableCell>
                      ))}
                      <TableCell>
                        {(customer.cartCount > 0 || customer.abandoned) && (
                          <CartItemsDialog
                            ownerType="customer"
                            ownerId={customer.id}
                            ownerName={customer.name}
                          />
                        )}
                        <Button asChild variant="ghost" size="icon">
                          <Link
                            href={`/customers/${customer.id}`}
                            aria-label={translate('viewCustomerName', {
                              name: customer.name
                            })}
                            title={translate('viewCustomer')}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                : page.visitors.map((visitor) => (
                    <TableRow key={visitor.id}>
                      <TableCell
                        className="max-w-[260px] truncate font-mono text-xs"
                        title={visitor.id}
                      >
                        {visitor.id}
                      </TableCell>
                      <TableCell>
                        {format.number(visitor.sessionsCount)}
                      </TableCell>
                      <TableCell>
                        {format.number(visitor.eventsCount)}
                      </TableCell>
                      <TableCell>{date(visitor.lastActivity)}</TableCell>
                      <TableCell>
                        <CartItemsDialog
                          ownerType="visitor"
                          ownerId={visitor.id}
                          ownerName={visitor.id}
                          totalLabel={money(
                            visitor.cartValue,
                            visitor.currency
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
      {page && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2">
            {translate('pageSize')}
            <select
              className="h-9 rounded-md border bg-background px-2"
              disabled={pending}
              value={query.size}
              onChange={(event) => update({ size: event.target.value })}
            >
              {[20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span>
            {translate('pageRange', {
              from: count ? query.offset + 1 : 0,
              to: count ? query.offset + count : 0,
              total: page.filteredTotal
            })}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={pending || query.offset === 0}
              aria-label={translate('previous')}
              title={translate('previous')}
              onClick={() =>
                update(
                  { offset: String(Math.max(0, query.offset - query.size)) },
                  false
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={
                pending || query.offset + query.size >= page.filteredTotal
              }
              aria-label={translate('next')}
              title={translate('next')}
              onClick={() =>
                update({ offset: String(query.offset + query.size) }, false)
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{translate('views.saveTitle')}</DialogTitle>
            <DialogDescription>
              {translate('views.saveDescription')}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const name = viewName.trim();
              if (!name || name.length > 80) {
                setNameError(true);
                return;
              }
              const id = crypto.randomUUID();
              const saved = {
                ...savedCustomerListQuery(new URLSearchParams(paramsText)),
                columns: columns.join(',') || 'none'
              };
              const savedSuccessfully = await persist({
                ...preferences,
                views: [...preferences.views, { id, name, query: saved }]
              });
              if (!savedSuccessfully) return;
              setSaveOpen(false);
              navigate(
                applyCustomerListView(
                  new URLSearchParams(paramsText),
                  saved,
                  id,
                  true
                )
              );
            }}
          >
            <label className="grid gap-2 text-sm">
              {translate('views.name')}
              <Input
                value={viewName}
                onChange={(event) => setViewName(event.target.value)}
                maxLength={80}
                required
                autoFocus
                aria-invalid={nameError}
              />
            </label>
            {nameError && (
              <p role="alert" className="text-sm text-destructive">
                {translate('views.invalidName')}
              </p>
            )}
            {preferenceError && (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{translate(`preferences.${preferenceError}`)}</p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={preferencesSaving}
                  onClick={reloadPreferences}
                >
                  {translate('preferences.retry')}
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaveOpen(false)}
              >
                {translate('views.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={!preferencesReady || preferencesSaving}
              >
                {translate('views.submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
