'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { EventType } from '@prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Mail,
  ShoppingCart,
} from 'lucide-react';

export interface CustomerRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatar: string | null;
  phone: string | null;
  createdAt: string;
  ordersCount: number;
  reviewsCount: number;
  lastOrderDate: string | null;
  lastOrderTotal: number | null;
  lastOrderCurrency: string | null;
  cartTotal: number;
  cartItemCount: number;
  favoriteCategories: string[];
  lastVisitDate: string | null;
  visitsCount: number;
  itemsVisited: number;
  searchesPerformed: number;
  eventCounts: Partial<Record<EventType, number>>;
  newsletter: boolean;
  preferredLanguage: string | null;
}

export interface AnonymousVisitorRow {
  visitorId: string;
  firstVisitDate: string;
  lastVisitDate: string;
  visitsCount: number;
  pageViews: number;
  itemsVisited: number;
  searchesPerformed: number;
  eventCounts: Partial<Record<EventType, number>>;
}

type SortColumn = 'email' | 'firstName' | 'lastName' | 'createdAt' | 'orders';
type SortOrder = 'asc' | 'desc';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatCurrency(amount: number, currency?: string | null): string {
  return `${currency ?? 'CLP'} ${amount.toLocaleString()}`;
}

function formatEventTypeLabel(eventType: string): string {
  return eventType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface SortableHeaderProps {
  label: string;
  column: SortColumn;
  currentSort: string;
  currentOrder: SortOrder;
  className?: string;
  onSort: (col: SortColumn, order: SortOrder) => void;
}

function SortableHeader({
  label,
  column,
  currentSort,
  currentOrder,
  className,
  onSort,
}: SortableHeaderProps) {
  const isActive = currentSort === column;
  const nextOrder: SortOrder =
    isActive && currentOrder === 'asc' ? 'desc' : 'asc';

  return (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(column, nextOrder)}
      >
        {label}
        {isActive ? (
          currentOrder === 'asc' ? (
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

export function CustomersTable({
  customers,
  anonymousVisitors,
  totalCustomers,
  offset,
  search,
  sortBy,
  sortOrder,
  eventTypes,
}: {
  customers: CustomerRow[];
  anonymousVisitors: AnonymousVisitorRow[];
  totalCustomers: number;
  offset: number;
  search: string;
  sortBy: string;
  sortOrder: SortOrder;
  eventTypes: EventType[];
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);
  const [isPending, startTransition] = useTransition();
  const perPage = 20;

  function buildUrl(overrides: Record<string, string | number>) {
    const params = new URLSearchParams({
      q: search,
      sort: sortBy,
      order: sortOrder,
    });
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined && value !== '') {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    }
    for (const [key, value] of Array.from(params.entries())) {
      if (!value) params.delete(key);
    }
    return `/customers?${params.toString()}`;
  }

  function handleSort(col: SortColumn, order: SortOrder) {
    router.push(buildUrl({ sort: col, order, offset: 0 }));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      router.push(buildUrl({ q: searchValue, offset: 0 }));
    });
  }

  function prevPage() {
    router.back();
  }

  function nextPage() {
    router.push(buildUrl({ offset }), { scroll: false });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                All Customers
                <Badge variant="secondary" className="ml-2 text-xs">
                  {totalCustomers}
                </Badge>
              </CardTitle>
              <CardDescription>
                Customer accounts, purchase history, and activity.
              </CardDescription>
            </div>
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-2.5 top-[0.55rem] h-4 w-4 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                type="search"
                placeholder="Search by name, email…"
                className="h-9 w-[220px] lg:w-[300px] pl-8 text-sm"
              />
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader
                  label="Customer"
                  column="firstName"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Email"
                  column="email"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Orders"
                  column="orders"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  onSort={handleSort}
                />
                <TableHead className="hidden lg:table-cell">Last Purchase</TableHead>
                <TableHead className="hidden lg:table-cell">Cart</TableHead>
                <TableHead className="hidden xl:table-cell">Preferred Categories</TableHead>
                <TableHead className="hidden lg:table-cell">Last Visit</TableHead>
                <TableHead className="hidden lg:table-cell">Visits</TableHead>
                <TableHead className="hidden lg:table-cell">Items Visited</TableHead>
                <TableHead className="hidden lg:table-cell">Searches</TableHead>
                <TableHead className="hidden xl:table-cell">Event Types</TableHead>
                <SortableHeader
                  label="Joined"
                  column="createdAt"
                  currentSort={sortBy}
                  currentOrder={sortOrder}
                  className="hidden md:table-cell"
                  onSort={handleSort}
                />
                <TableHead className="hidden md:table-cell">Info</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                    No customers found.
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <CustomerRowComponent key={c.id} customer={c} eventTypes={eventTypes} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
          <div className="flex items-center w-full justify-between">
            <div className="text-xs text-muted-foreground">
              Showing{' '}
              <strong>
                {Math.max(offset - customers.length + 1, 1)} – {Math.min(offset, totalCustomers)}
              </strong>{' '}
              of <strong>{totalCustomers}</strong> customers
            </div>
            <div className="flex">
              <Button
                onClick={prevPage}
                variant="ghost"
                size="sm"
                disabled={offset <= perPage}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Prev
              </Button>
              <Button
                onClick={nextPage}
                variant="ghost"
                size="sm"
                disabled={offset >= totalCustomers}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Unregistered Visitors
            <Badge variant="secondary" className="ml-2 text-xs">
              {anonymousVisitors.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Anonymous visitor sessions and recent browsing activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visitor</TableHead>
                <TableHead className="hidden md:table-cell">First Visit</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead className="hidden md:table-cell">Visits</TableHead>
                <TableHead className="hidden md:table-cell">Page Views</TableHead>
                <TableHead>Items Visited</TableHead>
                <TableHead>Searches</TableHead>
                <TableHead className="hidden lg:table-cell">Event Types</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anonymousVisitors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No unregistered visitors found.
                  </TableCell>
                </TableRow>
              ) : (
                anonymousVisitors.map((visitor) => (
                    <AnonymousVisitorRowComponent key={visitor.visitorId} visitor={visitor} eventTypes={eventTypes} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerRowComponent({
  customer: c,
  eventTypes,
}: {
  customer: CustomerRow;
  eventTypes: EventType[];
}) {
  const fullName =
    [c.firstName, c.lastName].filter(Boolean).join(' ') || c.username || '—';

  return (
    <TableRow>
      {/* Customer name & phone */}
      <TableCell>
        <div className="space-y-0.5">
          <div className="font-medium text-sm">{fullName}</div>
          {c.phone && (
            <div className="text-xs text-muted-foreground">{c.phone}</div>
          )}
        </div>
      </TableCell>

      {/* Email */}
      <TableCell className="text-sm">{c.email}</TableCell>

      {/* Orders count */}
      <TableCell>
        <div className="flex items-center gap-1.5">
          <span className="font-medium tabular-nums">{c.ordersCount}</span>
          {c.lastOrderTotal !== null && (
            <span className="text-xs text-muted-foreground">
              (last: {formatCurrency(c.lastOrderTotal, c.lastOrderCurrency)})
            </span>
          )}
        </div>
      </TableCell>

      {/* Last purchase */}
      <TableCell className="hidden lg:table-cell text-sm">
        {c.lastOrderDate ? (
          <div className="space-y-0.5">
            <div>{formatDate(c.lastOrderDate)}</div>
            <div className="text-xs text-muted-foreground">
              {formatRelative(c.lastOrderDate)}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Active cart */}
      <TableCell className="hidden lg:table-cell">
        {c.cartItemCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm tabular-nums">
              {c.cartItemCount} items
            </span>
            <span className="text-xs text-muted-foreground">
              ({formatCurrency(c.cartTotal)})
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Empty</span>
        )}
      </TableCell>

      {/* Preferred categories */}
      <TableCell className="hidden xl:table-cell">
        {c.favoriteCategories.length > 0 ? (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {c.favoriteCategories.slice(0, 3).map((cat) => (
              <Badge
                key={cat}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {cat}
              </Badge>
            ))}
            {c.favoriteCategories.length > 3 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0"
              >
                +{c.favoriteCategories.length - 3}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Last visit */}
      <TableCell className="hidden lg:table-cell text-sm">
        {c.lastVisitDate ? (
          <div className="space-y-0.5">
            <div>{formatRelative(c.lastVisitDate)}</div>
            <div className="text-[10px] text-muted-foreground">
              {formatDate(c.lastVisitDate)}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="hidden lg:table-cell text-sm tabular-nums">
        {c.visitsCount}
      </TableCell>

      <TableCell className="hidden lg:table-cell text-sm tabular-nums">
        {c.itemsVisited}
      </TableCell>

      <TableCell className="hidden lg:table-cell text-sm tabular-nums">
        {c.searchesPerformed}
      </TableCell>

      <TableCell className="hidden xl:table-cell">
        <div className="flex max-w-[260px] flex-wrap gap-1">
          {eventTypes.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            eventTypes
              .filter((eventType) => (c.eventCounts[eventType] ?? 0) > 0)
              .map((eventType) => (
                <Badge key={eventType} variant="outline" className="text-[10px] px-1.5 py-0">
                  {formatEventTypeLabel(eventType)}: {c.eventCounts[eventType]}
                </Badge>
              ))
          )}
        </div>
      </TableCell>

      {/* Joined */}
      <TableCell className="hidden md:table-cell text-sm">
        <div className="space-y-0.5">
          <div>{formatDate(c.createdAt)}</div>
          <div className="text-xs text-muted-foreground">
            {formatRelative(c.createdAt)}
          </div>
        </div>
      </TableCell>

      {/* Info badges */}
      <TableCell className="hidden md:table-cell">
        <div className="flex flex-wrap gap-1">
          {c.newsletter && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
              <Mail className="h-2.5 w-2.5" />
              Newsletter
            </Badge>
          )}
          {c.preferredLanguage && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 uppercase">
              {c.preferredLanguage}
            </Badge>
          )}
          {c.reviewsCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {c.reviewsCount} reviews
            </Badge>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function AnonymousVisitorRowComponent({
  visitor,
  eventTypes,
}: {
  visitor: AnonymousVisitorRow;
  eventTypes: EventType[];
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{visitor.visitorId.slice(0, 12)}...</TableCell>
      <TableCell className="hidden md:table-cell text-sm">
        <div className="space-y-0.5">
          <div>{formatDate(visitor.firstVisitDate)}</div>
          <div className="text-xs text-muted-foreground">{formatRelative(visitor.firstVisitDate)}</div>
        </div>
      </TableCell>
      <TableCell className="text-sm">
        <div className="space-y-0.5">
          <div>{formatRelative(visitor.lastVisitDate)}</div>
          <div className="text-[10px] text-muted-foreground">{formatDate(visitor.lastVisitDate)}</div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm tabular-nums">{visitor.visitsCount}</TableCell>
      <TableCell className="hidden md:table-cell text-sm tabular-nums">{visitor.pageViews}</TableCell>
      <TableCell className="text-sm tabular-nums">{visitor.itemsVisited}</TableCell>
      <TableCell className="text-sm tabular-nums">{visitor.searchesPerformed}</TableCell>
      <TableCell className="hidden lg:table-cell">
        <div className="flex max-w-[260px] flex-wrap gap-1">
          {eventTypes.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            eventTypes
              .filter((eventType) => (visitor.eventCounts[eventType] ?? 0) > 0)
              .map((eventType) => (
                <Badge key={eventType} variant="outline" className="text-[10px] px-1.5 py-0">
                  {formatEventTypeLabel(eventType)}: {visitor.eventCounts[eventType]}
                </Badge>
              ))
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
