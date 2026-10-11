'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Activity, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { useTimeZone } from '@/components/timezone-provider';
import {
  PROFILE_EVENT_CATEGORIES,
  groupProfileSessions,
  normalizeProfileEvent,
  type ProfileEventCategory
} from '@/lib/customer-profile-events';
import type { VisitorEventDetails } from '@/lib/visitor-events';

export function VisitorActivityDialog({
  visitorId,
  eventCount
}: {
  visitorId: string;
  eventCount: number;
}) {
  const translate = useTranslations('CustomerList.visitorActivity');
  const profile = useTranslations('CustomerProfile');
  const format = useFormatter();
  const locale = useLocale();
  const { timeZone } = useTimeZone();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<VisitorEventDetails | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [category, setCategory] = useState<ProfileEventCategory>('all');

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setDetails(null);
    setError(false);
    async function load() {
      try {
        const params = new URLSearchParams({ id: visitorId });
        const response = await fetch(
          `/api/customers/visitor-events?${params}`,
          {
            cache: 'no-store',
            signal: controller.signal
          }
        );
        if (!response.ok) throw new Error('visitorEventsUnavailable');
        const result: VisitorEventDetails = await response.json();
        if (!controller.signal.aborted) setDetails(result);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, visitorId, revision]);

  function date(iso: string) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'long',
      timeZone
    }).format(new Date(iso));
  }

  function guestInfo(
    info: NonNullable<VisitorEventDetails['recentEvents'][number]['guestInfo']>
  ) {
    return (
      <dl className="grid min-w-0 gap-1 text-xs sm:grid-cols-2">
        {[
          [translate('email'), info.email || translate('unknown')],
          [translate('fullName'), info.fullName || translate('unknown')],
          [
            translate('notifications'),
            info.notifications === null
              ? translate('unknown')
              : profile(info.notifications ? 'yes' : 'no')
          ]
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }

  const visibleSessions = groupProfileSessions(details?.recentEvents ?? [])
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
  const counts = new Map<string, number>();
  for (const event of details?.events ?? []) {
    const normalized = normalizeProfileEvent(event.type);
    if (category === 'all' || normalized.category === category) {
      counts.set(
        normalized.labelKey,
        (counts.get(normalized.labelKey) ?? 0) + event.count
      );
    }
  }
  const latestGuest = details?.guestCheckouts[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={translate('viewVisitor', {
                  count: eventCount,
                  visitor: visitorId
                })}
              >
                <Activity
                  className="mr-2 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span className="tabular-nums">
                  {format.number(eventCount)}
                </span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{translate('view')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="min-w-0 max-w-[calc(100vw-2rem)] sm:max-w-3xl">
        <DialogHeader className="min-w-0 pr-5">
          <DialogTitle>{translate('title')}</DialogTitle>
          <DialogDescription className="break-all">
            {visitorId}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 max-h-[65vh] overflow-y-auto overflow-x-hidden">
          {error ? (
            <div role="alert" className="space-y-3 py-4">
              <p className="text-sm text-destructive">{translate('failed')}</p>
              <Button
                variant="outline"
                onClick={() => setRevision((value) => value + 1)}
              >
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                {translate('retry')}
              </Button>
            </div>
          ) : !details ? (
            <div
              role="status"
              className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {translate('loading')}
            </div>
          ) : (
            <div className="min-w-0 space-y-5">
              {latestGuest && (
                <section className="min-w-0 space-y-2 border-b pb-4">
                  <h2 className="text-sm font-semibold">
                    {translate('latestGuestContact')}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {translate('guestContactSource')}
                  </p>
                  <time
                    dateTime={latestGuest.occurredAt}
                    className="block break-words text-xs text-muted-foreground"
                  >
                    {date(latestGuest.occurredAt)}
                  </time>
                  {guestInfo(latestGuest)}
                </section>
              )}
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">
                    {profile('timeline')}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {profile('activityWindow', {
                      count: details.recentEvents.length
                    })}
                  </p>
                  {details.hasMoreEvents && (
                    <p role="status" className="text-xs text-muted-foreground">
                      {translate('limited', {
                        count: details.recentEvents.length
                      })}
                    </p>
                  )}
                </div>
                <select
                  aria-label={profile('categoryFilter')}
                  className="h-9 max-w-full rounded border bg-background px-2 text-sm"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as ProfileEventCategory)
                  }
                >
                  {PROFILE_EVENT_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {profile(`categories.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
              <section className="space-y-2 border-b pb-4">
                <h2 className="text-sm font-semibold">
                  {translate('allTimeCounts')}
                </h2>
                {counts.size === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {profile('emptyEvents')}
                  </p>
                ) : (
                  <dl className="grid min-w-0 gap-x-6 gap-y-2 sm:grid-cols-2">
                    {Array.from(counts).map(([labelKey, count]) => (
                      <div
                        key={labelKey}
                        className="flex min-w-0 justify-between gap-3 text-sm"
                      >
                        <dt className="min-w-0 break-words">
                          {profile(labelKey)}
                        </dt>
                        <dd className="shrink-0 tabular-nums">
                          {format.number(count)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
              {visibleSessions.length === 0 && (
                <p className="py-6 text-sm text-muted-foreground">
                  {profile('emptyEvents')}
                </p>
              )}
              <div className="min-w-0 space-y-5">
                {visibleSessions.map((session) => (
                  <section key={session.id} className="min-w-0">
                    <h3 className="border-b py-2 text-xs font-semibold">
                      {profile('session', { number: session.number })}
                    </h3>
                    <ol className="divide-y">
                      {session.events.map((event) => (
                        <li
                          key={event.id}
                          className="flex min-w-0 flex-wrap justify-between gap-2 py-3 text-sm"
                        >
                          <div className="min-w-0 flex-1 basis-full space-y-2 sm:basis-0">
                            <p className="break-words font-medium">
                              {profile(
                                normalizeProfileEvent(event.eventType).labelKey
                              )}
                            </p>
                            {event.reference ? (
                              <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                                {event.reference.kind === 'search'
                                  ? profile('searchReference', {
                                      query: event.reference.value
                                    })
                                  : event.reference.value}
                              </p>
                            ) : event.pagePath ? (
                              <p className="break-all text-xs text-muted-foreground">
                                {profile('pageReference', {
                                  path: event.pagePath.split(/[?#]/, 1)[0]
                                })}
                              </p>
                            ) : null}
                            {event.guestInfo && guestInfo(event.guestInfo)}
                          </div>
                          <time
                            dateTime={event.occurredAt}
                            className="max-w-full break-words text-xs text-muted-foreground"
                          >
                            {date(event.occurredAt)}
                          </time>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
