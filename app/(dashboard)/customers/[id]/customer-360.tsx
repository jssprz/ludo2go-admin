'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Star,
  Mail,
  Phone,
  Globe,
  MapPin,
  TrendingUp,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useTimeZone } from '@/components/timezone-provider';
import {
  computeProfileChurnRisk,
  computeProfileSegment
} from '@/lib/customer-profile-metrics';
import {
  PROFILE_EVENT_CATEGORIES,
  normalizeProfileEvent,
  groupProfileSessions,
  type ProfileEventCategory
} from '@/lib/customer-profile-events';
import { CustomerNotes } from './customer-notes';

type Metrics = {
  ltv: number;
  aov: number;
  orderCount: number;
  avgDaysBetween: number | null;
  daysSinceLast: number | null;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
};
type Props = {
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    newsletter: boolean | null;
    preferredLanguage: string | null;
    preferredCurrency: string | null;
    favoriteGameCategories: string[];
    createdAt: string;
    addresses: Array<{
      id: string;
      label: string | null;
      line1: string;
      line2: string | null;
      city: string;
      region: string | null;
      country: string;
    }>;
    orders: Array<{
      id: string;
      status: string;
      total: number;
      currency: string;
      createdAt: string;
      itemCount: number;
    }>;
    reviews: Array<{
      id: string;
      rating: number;
      title: string;
      comment: string;
      createdAt: string;
      productName: string;
      sku: string;
    }>;
    recentEvents: Array<{
      id: string;
      eventType: string;
      occurredAt: string;
      pagePath: string | null;
      sessionId: string;
      reference: { kind: string; value: string } | null;
    }>;
    wishlistCount: number;
    cartItemCount: number;
  };
  metricsByCurrency: Record<string, Metrics>;
  initialCurrency: string;
};

const SEGMENT_COLORS: Record<string, string> = {
  champion: 'bg-emerald-100 text-emerald-800',
  loyal: 'bg-blue-100 text-blue-800',
  potential: 'bg-cyan-100 text-cyan-800',
  new: 'bg-teal-100 text-teal-800',
  at_risk: 'bg-amber-100 text-amber-800',
  hibernating: 'bg-orange-100 text-orange-800',
  inactive: 'bg-red-100 text-red-800',
  unknown: 'bg-gray-100 text-gray-600'
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-cyan-100 text-cyan-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800'
};

function useLocalTags(customerId: string) {
  const key = `customer-tags-${customerId}`;
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? '[]');
      setTags(
        Array.isArray(stored)
          ? stored.filter((tag): tag is string => typeof tag === 'string')
          : []
      );
    } catch {
      setTags([]);
    }
  }, [key]);
  function save(next: string[]) {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
    setTags(next);
  }
  return {
    tags,
    add: (tag: string) =>
      save(Array.from(new Set([...tags, tag.trim()])).filter(Boolean)),
    remove: (tag: string) => save(tags.filter((value) => value !== tag))
  };
}

function Kpi({
  label,
  value,
  sub
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0 border-l pl-3 py-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold break-words mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words min-w-0">
        {value}
      </span>
    </div>
  );
}

export function Customer360({
  customer,
  metricsByCurrency,
  initialCurrency
}: Props) {
  const translate = useTranslations('CustomerProfile');
  const locale = useLocale();
  const { timeZone } = useTimeZone();
  const [currency, setCurrency] = useState(initialCurrency);
  const [category, setCategory] = useState<ProfileEventCategory>('all');
  const { tags, add, remove } = useLocalTags(customer.id);
  const [tagInput, setTagInput] = useState('');
  const metrics =
    metricsByCurrency[currency] ?? metricsByCurrency[initialCurrency];
  const segment = computeProfileSegment(
    metrics.orderCount,
    metrics.daysSinceLast,
    metrics.avgDaysBetween
  );
  const churn = computeProfileChurnRisk(
    metrics.orderCount,
    metrics.daysSinceLast,
    metrics.avgDaysBetween
  );
  const fullName =
    [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
    customer.email;
  const initials =
    [customer.firstName?.[0], customer.lastName?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() || customer.email[0].toUpperCase();
  const unknown = translate('unknown');
  function money(amount: number, unit = currency) {
    return new Intl.NumberFormat(locale === 'es' ? 'es-CL' : 'en-US', {
      style: 'currency',
      currency: unit,
      maximumFractionDigits: unit === 'CLP' ? 0 : 2
    }).format(amount);
  }
  function date(iso: string, exact = false) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      ...(exact ? { timeStyle: 'long' as const } : {}),
      timeZone
    }).format(new Date(iso));
  }
  function days(value: number | null) {
    return value === null
      ? unknown
      : translate('dayCount', { count: Math.round(value) });
  }
  const sessions = groupProfileSessions(customer.recentEvents);
  const visibleSessions = sessions
    .map((session, index) => ({
      ...session,
      number: index + 1,
      events: session.events.filter(
        (event) =>
          category === 'all' ||
          normalizeProfileEvent(event.eventType).category === category
      )
    }))
    .filter((session) => session.events.length > 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/customers">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {translate('customers')}
          </Link>
        </Button>
        <div className="flex flex-1 min-w-0 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
            {initials}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold break-words">{fullName}</h1>
              <Badge className={SEGMENT_COLORS[segment]}>
                {translate(`segments.${segment}`)}
              </Badge>
            </div>
            <p className="text-sm">
              {translate('churnTitle')}:{' '}
              <span className="font-medium">{translate(`churn.${churn}`)}</span>
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1 break-all">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {customer.email}
              </span>
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {customer.phone}
                </span>
              )}
              <span>
                {translate('since', { date: date(customer.createdAt) })}
              </span>
            </div>
            <div
              className="flex flex-wrap gap-1.5"
              aria-label={translate('tags.local')}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs break-all"
                >
                  {tag}
                  <button
                    title={translate('tags.remove', { tag })}
                    aria-label={translate('tags.remove', { tag })}
                    onClick={() => remove(tag)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (tagInput.trim()) {
                    add(tagInput);
                    setTagInput('');
                  }
                }}
              >
                <Input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder={translate('tags.placeholder')}
                  aria-label={translate('tags.new')}
                  maxLength={80}
                  className="h-7 w-32 text-xs"
                />
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-3 border-y py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {translate('currencyScope', { currency })}
          </p>
          <label className="flex items-center gap-2 text-sm">
            {translate('currency')}
            <select
              className="h-8 rounded border bg-background px-2"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {Object.keys(metricsByCurrency).map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Kpi
            label={translate('ltv')}
            value={money(metrics.ltv)}
            sub={translate('completed')}
          />
          <Kpi
            label={translate('aov')}
            value={money(metrics.aov)}
            sub={translate('perOrder')}
          />
          <Kpi
            label={translate('orders')}
            value={String(metrics.orderCount)}
            sub={translate('orderCount', { count: metrics.orderCount })}
          />
          <Kpi
            label={translate('frequency')}
            value={days(metrics.avgDaysBetween)}
            sub={translate('betweenOrders')}
          />
          <Kpi
            label={translate('lastOrder')}
            value={days(metrics.daysSinceLast)}
            sub={
              metrics.lastOrderDate ? date(metrics.lastOrderDate) : undefined
            }
          />
          <Kpi
            label={translate('cart')}
            value={translate('itemCount', { count: customer.cartItemCount })}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Tabs defaultValue="orders">
            <TabsList className="max-w-full">
              <TabsTrigger value="orders">
                {translate('orders')}{' '}
                <Badge variant="secondary" className="ml-1">
                  {customer.orders.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="activity">
                {translate('activity')}
              </TabsTrigger>
              <TabsTrigger value="reviews">{translate('reviews')}</TabsTrigger>
            </TabsList>
            <TabsContent value="orders">
              {customer.orders.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {translate('emptyOrders')}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate('id')}</TableHead>
                      <TableHead>{translate('status')}</TableHead>
                      <TableHead className="text-right">
                        {translate('total')}
                      </TableHead>
                      <TableHead className="text-right">
                        {translate('items')}
                      </TableHead>
                      <TableHead>{translate('date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link
                            href={`/orders/${order.id}`}
                            className="font-mono text-xs underline-offset-2 hover:underline"
                            title={order.id}
                          >
                            #{order.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[order.status]}>
                            {translate(
                              `statuses.${STATUS_COLORS[order.status] ? order.status : 'unknown'}`
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {money(order.total, order.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {order.itemCount}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {date(order.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
            <TabsContent value="activity" className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  'product_view',
                  'search_performed',
                  'add_to_cart',
                  'purchase'
                ].map((type) => (
                  <Kpi
                    key={type}
                    label={translate(`events.${type}`)}
                    value={String(
                      customer.recentEvents.filter(
                        (event) =>
                          normalizeProfileEvent(event.eventType).labelKey ===
                          `events.${type}`
                      ).length
                    )}
                  />
                ))}
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {translate('timeline')}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {translate('activityWindow', {
                      count: customer.recentEvents.length
                    })}
                  </p>
                </div>
                <select
                  aria-label={translate('categoryFilter')}
                  className="h-9 max-w-full rounded border bg-background px-2 text-sm"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as ProfileEventCategory)
                  }
                >
                  {PROFILE_EVENT_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {translate(`categories.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
              {visibleSessions.length === 0 && (
                <p className="py-6 text-sm text-muted-foreground">
                  {translate('emptyEvents')}
                </p>
              )}
              <div className="max-h-[36rem] overflow-y-auto space-y-5">
                {visibleSessions.map((session) => (
                  <section key={session.id}>
                    <h3 className="text-xs font-semibold border-b py-2">
                      {translate('session', { number: session.number })}
                    </h3>
                    <ol className="divide-y">
                      {session.events.map((event) => (
                        <li
                          key={event.id}
                          className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium">
                              {translate(
                                normalizeProfileEvent(event.eventType).labelKey
                              )}
                            </p>
                            {event.reference ? (
                              <p className="text-xs text-muted-foreground break-words">
                                {event.reference.kind === 'order' ? (
                                  <Link
                                    href={`/orders/${event.reference.value}`}
                                    className="underline"
                                  >
                                    {translate('orderReference', {
                                      reference: event.reference.value.slice(
                                        0,
                                        8
                                      )
                                    })}
                                  </Link>
                                ) : event.reference.kind === 'search' ? (
                                  translate('searchReference', {
                                    query: event.reference.value
                                  })
                                ) : (
                                  event.reference.value
                                )}
                              </p>
                            ) : (
                              event.pagePath && (
                                <p className="text-xs text-muted-foreground break-all">
                                  {translate('pageReference', {
                                    path: event.pagePath.split('?')[0]
                                  })}
                                </p>
                              )
                            )}
                          </div>
                          <time
                            dateTime={event.occurredAt}
                            className="text-xs text-muted-foreground shrink-0"
                          >
                            {date(event.occurredAt, true)}
                          </time>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="reviews">
              {customer.reviews.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {translate('emptyReviews')}
                </p>
              )}
              <div className="divide-y">
                {customer.reviews.map((review) => (
                  <article key={review.id} className="py-4 space-y-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          {review.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {review.sku}
                        </p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span
                          className="flex gap-0.5"
                          aria-label={`${review.rating}/5`}
                        >
                          {[1, 2, 3, 4, 5].map((value) => (
                            <Star
                              key={value}
                              aria-hidden
                              className={`h-3.5 w-3.5 ${value <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
                            />
                          ))}
                        </span>
                        <time dateTime={review.createdAt} className="text-xs">
                          {date(review.createdAt)}
                        </time>
                      </div>
                    </div>
                    <p className="font-semibold text-sm break-words">
                      {review.title}
                    </p>
                    <p className="text-sm text-muted-foreground break-words">
                      {review.comment}
                    </p>
                  </article>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="min-w-0 space-y-5">
          <section className="space-y-3 border-t pt-4">
            <h2 className="flex gap-2 items-center text-sm font-semibold">
              <TrendingUp className="h-4 w-4" />
              {translate('rfm')}
            </h2>
            <Row
              label={translate('recency')}
              value={days(metrics.daysSinceLast)}
            />
            <Row
              label={translate('frequency')}
              value={translate('orderCount', { count: metrics.orderCount })}
            />
            <Row label={translate('monetary')} value={money(metrics.ltv)} />
            <p className="text-xs text-muted-foreground">
              {translate('rfmExplanation')}
            </p>
            <p className="text-xs text-muted-foreground">
              {translate('segmentRule', {
                rule: translate(`segmentRules.${segment}`)
              })}
            </p>
            <Row
              label={translate('churnTitle')}
              value={translate(`churn.${churn}`)}
            />
            <p className="text-xs text-muted-foreground">
              {translate('churnExplanation')}
            </p>
          </section>
          <section className="space-y-2 border-t pt-4">
            <h2 className="flex gap-2 items-center text-sm font-semibold">
              <Globe className="h-4 w-4" />
              {translate('preferences')}
            </h2>
            <Row
              label={translate('language')}
              value={customer.preferredLanguage?.toUpperCase() ?? unknown}
            />
            <Row
              label={translate('currency')}
              value={customer.preferredCurrency ?? unknown}
            />
            <Row
              label={translate('newsletter')}
              value={
                customer.newsletter === null
                  ? unknown
                  : translate(customer.newsletter ? 'yes' : 'no')
              }
            />
            <Row
              label={translate('wishlist')}
              value={translate('itemCount', { count: customer.wishlistCount })}
            />
            {customer.favoriteGameCategories.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {translate('favoriteCategories')}
                </p>
                <div className="flex flex-wrap gap-1">
                  {customer.favoriteGameCategories.map((value) => (
                    <Badge key={value} variant="secondary">
                      {value}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </section>
          {customer.addresses.length > 0 && (
            <section className="space-y-2 border-t pt-4">
              <h2 className="flex gap-2 items-center text-sm font-semibold">
                <MapPin className="h-4 w-4" />
                {translate('addresses', { count: customer.addresses.length })}
              </h2>
              {customer.addresses.map((address) => (
                <address
                  key={address.id}
                  className="text-xs text-muted-foreground not-italic break-words"
                >
                  {address.label && (
                    <strong className="block text-foreground">
                      {address.label}
                    </strong>
                  )}
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ''}
                  <span className="block">
                    {address.city}
                    {address.region ? `, ${address.region}` : ''} ·{' '}
                    {address.country}
                  </span>
                </address>
              ))}
            </section>
          )}
          <CustomerNotes customerId={customer.id} locale={locale} />
        </aside>
      </div>
    </div>
  );
}
