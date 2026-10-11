'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import type { CustomerDuplicatePage } from '@/lib/customer-list';

export function DuplicateReview({ search }: { search: string }) {
  const translate = useTranslations('CustomerList');
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<CustomerDuplicatePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setPage(null);
    fetch(
      `/api/customers/duplicates?${new URLSearchParams({ q: search, offset: String(offset), size: '20' })}`,
      { signal: controller.signal, cache: 'no-store' }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('duplicateReviewFailed');
        return response.json() as Promise<CustomerDuplicatePage>;
      })
      .then((value) => {
        if (!controller.signal.aborted) setPage(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, offset, search, retry]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setOffset(0);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="mr-2 h-4 w-4" />
          {translate('duplicates.review')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{translate('duplicates.title')}</DialogTitle>
          <DialogDescription>
            {translate('duplicates.description')}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {translate('duplicates.blocked')}
        </p>
        {loading && <p role="status">{translate('duplicates.loading')}</p>}
        {failed && (
          <div role="alert" className="space-y-2">
            <p>{translate('duplicates.failed')}</p>
            <Button
              variant="outline"
              onClick={() => setRetry((value) => value + 1)}
            >
              {translate('retry')}
            </Button>
          </div>
        )}
        {page && (
          <>
            {page.candidates.length === 0 ? (
              <p>{translate('duplicates.empty')}</p>
            ) : (
              <div className="divide-y">
                {page.candidates.map((pair) => (
                  <div
                    key={`${pair.customer.id}:${pair.candidate.id}`}
                    className="space-y-3 py-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[pair.customer, pair.candidate].map((identity) => (
                        <div key={identity.id} className="min-w-0">
                          <Link
                            className="font-medium underline"
                            href={identity.href}
                            aria-label={translate('duplicates.profileName', {
                              name: identity.name
                            })}
                          >
                            {identity.name}
                          </Link>
                          <div className="break-all text-sm text-muted-foreground">
                            {identity.email}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {identity.phone ?? translate('unknown')}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pair.reasons.map((reason) => (
                        <Badge key={reason} variant="secondary">
                          {translate(`duplicates.reasons.${reason}`)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                {translate('duplicates.range', {
                  from: page.candidates.length ? page.offset + 1 : 0,
                  to: page.candidates.length
                    ? page.offset + page.candidates.length
                    : 0,
                  total: page.total
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={loading || offset === 0}
                  aria-label={translate('previous')}
                  onClick={() => setOffset(Math.max(0, offset - 20))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={loading || offset + page.size >= page.total}
                  aria-label={translate('next')}
                  onClick={() => setOffset(offset + page.size)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
