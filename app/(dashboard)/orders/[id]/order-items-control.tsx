'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type VariantResult = {
  id: string;
  sku: string;
  product: { name: string };
};

type ItemSummary = {
  id: string;
  quantity: number;
  unitPrice: number;
  isGift: boolean;
  giftReason: string | null;
  cancelledQuantity: number;
};

const CANCELLATION_REASONS = [
  'price_error',
  'customer_request',
  'out_of_stock',
  'duplicate',
  'damaged',
  'other',
] as const;

function reasonLabel(reason: (typeof CANCELLATION_REASONS)[number]): string {
  return reason.split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
}

export function OrderItemsControl({ orderId, currency, items }: { orderId: string; currency: string; items: ItemSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [variants, setVariants] = useState<VariantResult[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<VariantResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [isGift, setIsGift] = useState(false);
  const [giftReason, setGiftReason] = useState('');
  const [searching, setSearching] = useState(false);

  async function save(payload: unknown, successMessage: string) {
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message ?? 'Could not update order items.');
      setMessage(successMessage);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update order items.');
    } finally {
      setBusy(false);
    }
  }

  async function searchVariants(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setVariants([]);
      return;
    }
    setSearching(true);
    try {
      const response = await fetch(`/api/variants/search?q=${encodeURIComponent(value.trim())}`);
      const result = await response.json().catch(() => []);
      if (response.ok) {
        setVariants(Array.isArray(result) ? result : []);
      }
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-2">
        <Label htmlFor={`variant-search-${orderId}`}>Add product</Label>
        {!selectedVariant ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id={`variant-search-${orderId}`}
                className="pl-8"
                placeholder="Search by product name or SKU..."
                value={query}
                onChange={(event) => { void searchVariants(event.target.value); }}
                disabled={busy}
              />
            </div>
            {searching && <p className="text-xs text-muted-foreground">Searching products...</p>}
            {variants.length > 0 && (
              <div className="max-h-48 divide-y overflow-y-auto rounded border">
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className="w-full p-2 text-left text-sm hover:bg-muted/50"
                    onClick={() => {
                      setSelectedVariant(variant);
                      setQuery('');
                      setVariants([]);
                    }}
                    disabled={busy}
                  >
                    <p className="font-medium">{variant.product.name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {variant.sku}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 rounded border p-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{selectedVariant.product.name}</p>
                <p className="text-xs text-muted-foreground">SKU: {selectedVariant.sku}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedVariant(null);
                  setVariants([]);
                  setQuery('');
                }}
                disabled={busy}
              >
                Change
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`add-qty-${orderId}`}>Quantity</Label>
                <Input
                  id={`add-qty-${orderId}`}
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`add-price-${orderId}`}>Unit price ({currency})</Label>
                <Input
                  id={`add-price-${orderId}`}
                  type="number"
                  min={0}
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(Math.max(0, Number(event.target.value) || 0))}
                  disabled={busy}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isGift}
                  onChange={(event) => setIsGift(event.target.checked)}
                  disabled={busy}
                />
                Mark as gift
              </Label>
              {isGift && (
                <Input
                  placeholder="Gift reason"
                  value={giftReason}
                  onChange={(event) => setGiftReason(event.target.value)}
                  disabled={busy}
                />
              )}
            </div>
            <Button
              type="button"
              size="sm"
              disabled={busy || (isGift && giftReason.trim().length === 0)}
              onClick={() => {
                if (!selectedVariant) return;
                void save(
                  {
                    addItem: {
                      variantId: selectedVariant.id,
                      quantity,
                      unitPrice,
                      isGift,
                      giftReason: giftReason.trim() || null,
                    },
                  },
                  'Item added.'
                ).then(() => {
                  setSelectedVariant(null);
                  setQuantity(1);
                  setUnitPrice(0);
                  setIsGift(false);
                  setGiftReason('');
                });
              }}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add item
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const remaining = Math.max(0, item.quantity - item.cancelledQuantity);
          return (
            <div key={item.id} className="rounded border p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Remaining: {remaining} / {item.quantity}
                </p>
                <p className="text-xs text-muted-foreground">
                  Unit price: {new Intl.NumberFormat('es-CL', { style: 'currency', currency }).format(item.unitPrice)}
                </p>
              </div>

              <form
                className="mt-2 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const cancelQuantity = Number(form.get('cancelQuantity') || 1);
                  const reason = String(form.get('reason') || 'other');
                  const details = String(form.get('details') || '').trim();
                  void save(
                    {
                      cancelItem: {
                        orderItemId: item.id,
                        quantity: cancelQuantity,
                        reason,
                        details: details || null,
                      },
                    },
                    'Item cancelled.'
                  );
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor={`cancel-qty-${item.id}`} className="text-xs">Cancel qty</Label>
                  <Input id={`cancel-qty-${item.id}`} name="cancelQuantity" type="number" min={1} max={remaining} defaultValue={1} className="h-8 w-20" disabled={busy || remaining === 0} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cancel-reason-${item.id}`} className="text-xs">Reason</Label>
                  <select id={`cancel-reason-${item.id}`} name="reason" className="h-8 rounded border bg-background px-2 text-sm" disabled={busy || remaining === 0} defaultValue="other">
                    {CANCELLATION_REASONS.map((reason) => (
                      <option key={reason} value={reason}>{reasonLabel(reason)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`cancel-details-${item.id}`} className="text-xs">Details (optional)</Label>
                  <Input id={`cancel-details-${item.id}`} name="details" className="h-8 min-w-52" disabled={busy || remaining === 0} />
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={busy || remaining === 0}>Cancel units</Button>
              </form>

              <form
                className="mt-2 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const nextGift = form.get('isGift') === 'true';
                  const nextReason = String(form.get('giftReason') || '').trim();
                  void save(
                    {
                      giftItem: {
                        orderItemId: item.id,
                        isGift: nextGift,
                        giftReason: nextReason || null,
                      },
                    },
                    nextGift ? 'Item marked as gift.' : 'Gift removed.'
                  );
                }}
              >
                <input type="hidden" name="isGift" value={item.isGift ? 'false' : 'true'} />
                <div className="space-y-1">
                  <Label htmlFor={`gift-reason-${item.id}`} className="text-xs">{item.isGift ? 'Gift reason' : 'Reason to mark as gift'}</Label>
                  <Input
                    id={`gift-reason-${item.id}`}
                    name="giftReason"
                    className="h-8 min-w-56"
                    defaultValue={item.giftReason ?? ''}
                    placeholder="Optional when removing gift"
                    disabled={busy || !item.isGift && remaining === 0}
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={busy || (!item.isGift && remaining === 0)}
                >
                  {item.isGift ? 'Remove gift' : 'Mark as gift'}
                </Button>
              </form>
            </div>
          );
        })}
      </div>

      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {busy ? 'Saving order items...' : message}
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
