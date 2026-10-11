'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Loader2, Package, ShoppingCart } from 'lucide-react';
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
import type {
  CustomerCartDetails,
  CustomerCartOwnerType
} from '@/lib/customer-cart';

export function CartItemsDialog({
  ownerId,
  ownerType,
  ownerName,
  totalLabel
}: {
  ownerId: string;
  ownerType: CustomerCartOwnerType;
  ownerName: string;
  totalLabel?: string;
}) {
  const translate = useTranslations('CustomerList.cartItems');
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<CustomerCartDetails | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setDetails(null);
    setError(false);
    async function load() {
      try {
        const params = new URLSearchParams({ type: ownerType, id: ownerId });
        const response = await fetch(`/api/customers/cart-items?${params}`, {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!response.ok) throw new Error('cartUnavailable');
        const result: CustomerCartDetails = await response.json();
        if (!controller.signal.aborted) setDetails(result);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, ownerId, ownerType, revision]);

  const money = (amount: number, currency: string) =>
    format.number(amount, { style: 'currency', currency });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size={totalLabel ? 'sm' : 'icon'}
          aria-label={translate('viewOwner', { name: ownerName })}
          title={translate('view')}
        >
          <ShoppingCart className="h-4 w-4 shrink-0" />
          {totalLabel && (
            <span className="ml-2 tabular-nums">{totalLabel}</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-0 max-w-[calc(100vw-2rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{translate('title')}</DialogTitle>
          <DialogDescription className="break-all">
            {ownerName}
          </DialogDescription>
        </DialogHeader>
        <div className="min-w-0 max-h-[65vh] overflow-y-auto">
          {error ? (
            <div role="alert" className="space-y-3 py-4">
              <p className="text-sm text-destructive">{translate('failed')}</p>
              <Button
                variant="outline"
                onClick={() => setRevision((value) => value + 1)}
              >
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
          ) : details.carts.length === 0 ? (
            <p className="py-8 text-sm text-muted-foreground">
              {translate('empty')}
            </p>
          ) : (
            <div className="space-y-6">
              {details.carts.map((cart) => (
                <section key={cart.id} className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <Badge variant="secondary">
                      {translate(`statuses.${cart.status}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(cart.updatedAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>
                  <ul className="divide-y">
                    {cart.items.map((item) => (
                      <li
                        key={item.id}
                        className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)] gap-3 py-3"
                      >
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border bg-muted">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Package
                              className="h-5 w-5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="break-words text-sm font-medium">
                            {item.name}
                          </p>
                          <p className="break-all text-xs text-muted-foreground">
                            {item.sku}
                          </p>
                          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs tabular-nums">
                            <span>
                              {translate('quantity', { count: item.quantity })}
                            </span>
                            <span>
                              {translate('unitPrice', {
                                value:
                                  item.unitPrice === null
                                    ? translate('unknownPrice')
                                    : money(item.unitPrice, cart.currency)
                              })}
                            </span>
                            <span className="font-medium">
                              {translate('lineTotal', {
                                value:
                                  item.unitPrice === null
                                    ? translate('unknownPrice')
                                    : money(
                                        item.unitPrice * item.quantity,
                                        cart.currency
                                      )
                              })}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              {details.hasMore && (
                <p role="status" className="text-sm text-muted-foreground">
                  {translate('limited')}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
