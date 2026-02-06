'use client';

import { useState, FormEvent } from 'react';
import { ProductVariant, ItemPriceInStore, Product, Price, PriceType } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { Trash2, Plus, Check } from 'lucide-react';

type VariantStatus = ProductVariant['status'];
type Condition = ProductVariant['condition'];

type VariantWithRelations = ProductVariant & {
  product: Product;
  prices: Price[];
  externalPrices: ItemPriceInStore[];
};

type StoreLink = {
  storeId: string;
  storeName: string;
  storeBaseUrl: string;
  existingPath: string;
  observedPrice: number | null;
  observedAt: string | null;   // ISO string
  currency: string | null;
};

type StoreLinkState = StoreLink & { fullUrl: string };

type Props = {
  variant: VariantWithRelations;
  storeLinks: StoreLink[];
};

function buildFullUrl(base: string, path: string): string {
  if (!path) return '';
  try {
    const maybe = new URL(path);
    return maybe.toString();
  } catch {
    const baseUrl = new URL(base);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return new URL(normalizedPath, baseUrl).toString();
  }
}

function formatObservedAt(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  } catch {
    return iso;
  }
}

export function VariantEditForm({ variant, storeLinks }: Props) {
  const router = useRouter();

  const [sku, setSku] = useState(variant.sku);
  const [edition, setEdition] = useState(variant.edition ?? '');
  const [language, setLanguage] = useState(variant.language ?? '');
  const [status, setStatus] = useState<VariantStatus>(variant.status);
  const [condition, setCondition] = useState<Condition>(variant.condition);

  const [storesState, setStoresState] = useState<StoreLinkState[]>(
    storeLinks.map((s) => ({
      ...s,
      fullUrl: buildFullUrl(s.storeBaseUrl, s.existingPath),
    }))
  );

  // Initialize prices - you may need to adjust based on your actual variant schema
  const [prices, setPrices] = useState<Price[]>(variant.prices);

  const [isSaving, setIsSaving] = useState(false);
  const [scrapingStoreId, setScrapingStoreId] = useState<string | null>(null);
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleStoreUrlChange(storeId: string, value: string) {
    setStoresState((prev) =>
      prev.map((s) =>
        s.storeId === storeId ? { ...s, fullUrl: value } : s
      )
    );
  }

  // Price management functions
  function handleAddPrice() {
    const newPrice: Price = {
      id: `temp-${Date.now()}`,
      amount: 0,
      currency: 'CLP',
      type: PriceType.retail,
      active: true,
      startsAt: null,
      endsAt: null,
      variantId: variant.id,
      taxIncluded: false,
      region: null,
      channelId: null, // Adjust if you have channels
      priceBookId: null, // Adjust if you have price books
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setPrices((prev) => [...prev, newPrice]);
  }

  function handlePriceChange(
    id: string,
    field: keyof Price,
    value: any
  ) {
    setPrices((prev) =>
      prev.map((price) =>
        price.id === id ? { ...price, [field]: value } : price
      )
    );
  }

  function handleRemovePrice(id: string) {
    setPrices((prev) => prev.filter((price) => price.id !== id));
  }

  function handleToggleActivePrice(id: string) {
    setPrices((prev) =>
      prev.map((price) =>
        price.id === id ? { ...price, isActive: !price.active } : price
      )
    );
  }

  async function scrapeOne(storeId: string, { silent = false } = {}) {
    const store = storesState.find((s) => s.storeId === storeId);
    if (!store || !store.fullUrl.trim()) {
      if (!silent) setErrorMsg('Please set a valid URL before scraping.');
      return;
    }

    if (!silent) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setScrapingStoreId(storeId);
    }

    try {
      const res = await fetch(
        `/variants/${variant.id}/scrape-price`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: store.fullUrl.trim() }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || 'Scrape failed');
      }

      // Si tu API devuelve result con price/currency/observedAt, úsalo para actualizar el estado.
      const result = data?.result as
        | { price: number | null; currency?: string | null; observedAt?: string }
        | undefined;

      if (result?.price != null) {
        setStoresState((prev: StoreLinkState[]) =>
          prev.map((s) =>
            s.storeId === storeId
              ? {
                  ...s,
                  observedPrice: result.price!,
                  currency: result.currency ?? s.currency ?? 'CLP',
                  observedAt:
                    result.observedAt ??
                    new Date().toISOString(),
                }
              : s,
          ),
        );
      }

      if (!silent) {
        setSuccessMsg(
          `Scraped price successfully for ${store.storeName}.`,
        );
      }
    } catch (err: any) {
      if (!silent) {
        setErrorMsg(err.message || 'Error scraping price');
      }
    } finally {
      if (!silent) setScrapingStoreId(null);
    }
  }

  async function handleScrape(storeId: string) {
    await scrapeOne(storeId);
  }

  async function handleScrapeAll() {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsScrapingAll(true);

    try {
      // Scrape secuencialmente todas las tiendas que tengan URL
      for (const s of storesState) {
        if (!s.fullUrl.trim()) continue;
        await scrapeOne(s.storeId, { silent: true });
      }
      setSuccessMsg('Scraped prices for all stores with URLs.');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error scraping all stores');
    } finally {
      setIsScrapingAll(false);
      setScrapingStoreId(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const storeUrlsPayload = storesState
      .filter((s) => s.fullUrl.trim() !== '')
      .map((s) => ({
        storeId: s.storeId,
        fullUrl: s.fullUrl.trim(),
      }));

    try {
      const res = await fetch(`/api/admin/variants/${variant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          edition: edition || null,
          language: language || null,
          status,
          condition,
          storeUrls: storeUrlsPayload,
          prices: prices,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to update variant');
      }

      setSuccessMsg('Variant updated successfully.');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unexpected error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Variant core fields (simplified) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edition">Edition</Label>
          <Input
            id="edition"
            value={edition}
            onChange={(e) => setEdition(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select
            value={language}
            onValueChange={(val) => setLanguage(val as typeof language)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as VariantStatus)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select kind" />
            </SelectTrigger>
            <SelectContent>
              {/* Ajusta según el enum ProductKind que tengas */}
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Two-column layout: Store URLs (left) and Variant Prices (right) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Store URLs section */}
        <div className="space-y-3 border rounded-md p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Store links for this variant</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isScrapingAll || storesState.every((s) => !s.fullUrl.trim())}
              onClick={handleScrapeAll}
            >
              {isScrapingAll ? 'Scraping all…' : 'Scrape All'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Paste the full URL of this variant in each store. We&apos;ll store only the
            path for scraping.
          </p>

          <div className="space-y-2">
            {storesState.map((store) => (
              <div key={store.storeId} className="space-y-1">
                <Label htmlFor={`store-${store.storeId}`}>
                  {store.storeName}{' '}
                  <span className="text-xs text-muted-foreground">
                    (<Link href={store.storeBaseUrl} target='__blank'>{store.storeBaseUrl}</Link>)
                  </span>
                </Label>

                <div className="flex items-center gap-2">
                  <Input
                    id={`store-${store.storeId}`}
                    placeholder={`${store.storeBaseUrl}/...`}
                    value={store.fullUrl}
                    onChange={(e) =>
                      handleStoreUrlChange(store.storeId, e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      !store.fullUrl.trim() ||
                      scrapingStoreId === store.storeId
                    }
                    onClick={() => handleScrape(store.storeId)}
                  >
                    {scrapingStoreId === store.storeId ? 'Scraping…' : 'Scrape'}
                  </Button>
                </div>

                {(store.observedPrice != null || store.observedAt) && (
                  <p className="text-xs text-muted-foreground">
                    Current:{' '}
                    {store.observedPrice != null
                      ? `${store.observedPrice.toLocaleString('es-CL')} ${
                          store.currency || 'CLP'
                        }`
                      : '—'}{' '}
                    {store.observedAt && (
                      <>
                        · {formatObservedAt(store.observedAt)}
                      </>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Variant Prices Section */}
        <div className="space-y-3 border rounded-md p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Variant Prices</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddPrice}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Price
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Manage the pricing for this variant. Mark a price as active to use it.
        </p>

        {prices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No prices added yet. Click &quot;Add Price&quot; to create one.
          </p>
        ) : (
          <div className="space-y-3">
            {prices.map((price) => (
              <div
                key={price.id}
                className={`border rounded-md p-3 space-y-3 ${
                  price.active ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={price.active ? 'default' : 'outline'}
                      onClick={() => handleToggleActivePrice(price.id)}
                      className="h-8"
                    >
                      {price.active && <Check className="h-3 w-3 mr-1" />}
                      {price.active ? 'Active' : 'Inactive'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {price.type.charAt(0).toUpperCase() + price.type.slice(1)} Price
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemovePrice(price.id)}
                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor={`price-amount-${price.id}`}>Amount</Label>
                    <Input
                      id={`price-amount-${price.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={price.amount}
                      onChange={(e) =>
                        handlePriceChange(
                          price.id,
                          'amount',
                          parseFloat(e.target.value) || 0
                        )
                      }
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`price-currency-${price.id}`}>Currency</Label>
                    <Select
                      value={price.currency}
                      onValueChange={(val) =>
                        handlePriceChange(price.id, 'currency', val)
                      }
                    >
                      <SelectTrigger id={`price-currency-${price.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLP">CLP</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="ARS">ARS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`price-type-${price.id}`}>Price Type</Label>
                    <Select
                      value={price.type}
                      onValueChange={(val) =>
                        handlePriceChange(price.id, 'type', val)
                      }
                    >
                      <SelectTrigger id={`price-type-${price.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="list">List Price</SelectItem>
                        <SelectItem value="sale">Sale Price</SelectItem>
                        <SelectItem value="cost">Cost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`price-start-${price.id}`}>
                      Start Date (optional)
                    </Label>
                    <Input
                      id={`price-start-${price.id}`}
                      type="date"
                      value={price.startsAt?.toISOString().split('T')[0] || ''}
                      onChange={(e) =>
                        handlePriceChange(
                          price.id,
                          'startsAt',
                          e.target.value || null
                        )
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`price-end-${price.id}`}>
                      End Date (optional)
                    </Label>
                    <Input
                      id={`price-end-${price.id}`}
                      type="date"
                      value={price.endsAt?.toISOString().split('T')[0] || ''}
                      onChange={(e) =>
                        handlePriceChange(
                          price.id,
                          'endsAt',
                          e.target.value || null
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>


      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
      {successMsg && (
        <p className="text-sm text-emerald-600">{successMsg}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}