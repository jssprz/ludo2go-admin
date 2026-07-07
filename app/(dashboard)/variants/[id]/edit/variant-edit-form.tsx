'use client';

import { useState, FormEvent } from 'react';
import { ProductVariant, ItemPriceInStore, Product, Price, PriceType, Inventory, Location } from '@prisma/client';
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
import { Trash2, Plus, Check, Wand2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Language = ProductVariant['language'];
type VariantStatus = ProductVariant['status'];
type Condition = ProductVariant['condition'];
type PackagingType = ProductVariant['packageType'];

type VariantWithRelations = ProductVariant & {
  product: Product;
  prices: Price[];
  externalPrices: ItemPriceInStore[];
  inventory?: (Inventory & { location: Location })[];
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
  locations: Location[];
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

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return '';
}

function toDatetimeLocalValue(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function VariantEditForm({ variant, storeLinks, locations }: Props) {
  const router = useRouter();
  const t = useTranslations('variantEditForm');
  const tc = useTranslations('common');

  const [sku, setSku] = useState(variant.sku);
  const [edition, setEdition] = useState(variant.edition ?? '');
  const [language, setLanguage] = useState<Language>(variant.language);
  const [status, setStatus] = useState<VariantStatus>(variant.status);
  const [activeAtScheduled, setActiveAtScheduled] = useState<string>(
    toDatetimeLocalValue(variant.activeAtScheduled)
  );
  const [condition, setCondition] = useState<Condition>(variant.condition);
  const [packageType, setPackageType] = useState<PackagingType>(variant.packageType);
  const [weightGrams, setWeightGrams] = useState<number | null>(variant.weightGrams);
  const [widthMm, setWidthMm] = useState<number | null>(variant.widthMm);
  const [heightMm, setHeightMm] = useState<number | null>(variant.heightMm);
  const [depthMm, setDepthMm] = useState<number | null>(variant.depthMm);

  const [storesState, setStoresState] = useState<StoreLinkState[]>(
    storeLinks.map((s) => ({
      ...s,
      fullUrl: buildFullUrl(s.storeBaseUrl, s.existingPath),
    }))
  );

  // Initialize prices - you may need to adjust based on your actual variant schema
  const [prices, setPrices] = useState<Price[]>(variant.prices);

  // Initialize inventory state
  const [inventoryData, setInventoryData] = useState<Record<string, { onHand: number; reserved: number }>>(
    locations.reduce((acc, location) => {
      const existing = variant.inventory?.find(inv => inv.locationId === location.id);
      acc[location.id] = {
        onHand: existing?.onHand ?? 0,
        reserved: existing?.reserved ?? 0,
      };
      return acc;
    }, {} as Record<string, { onHand: number; reserved: number }>)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [scrapingStoreId, setScrapingStoreId] = useState<string | null>(null);
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [isScrapingPhysical, setIsScrapingPhysical] = useState(false);
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function toNullableNumber(value: string): number | null {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function handleStoreUrlChange(storeId: string, value: string) {
    setStoresState((prev) =>
      prev.map((s) =>
        s.storeId === storeId ? { ...s, fullUrl: value } : s
      )
    );
  }

  async function handleGenerateSku() {
    setIsGeneratingSku(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/variants/generate-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: variant.productId,
          language,
          edition: edition.trim() || null,
          format: null, // Use current attributes — no format field in edit form
          bundle: null,
          condition,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t('errors.generateSku'));
      }

      setSku(data.sku);
    } catch (err: any) {
      setErrorMsg(err.message || t('errors.generateSku'));
    } finally {
      setIsGeneratingSku(false);
    }
  }

  // Price management functions
  function handleAddPrice() {
    const newPrice: Price = {
      id: `temp-${Date.now()}`,
      createdByAdminUserId: null,
      updatedByAdminUserId: null,
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
      sourceRuleId: null,
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
        price.id === id ? { ...price, active: !price.active } : price
      )
    );
  }

  async function scrapeOne(storeId: string, { silent = false } = {}) {
    const store = storesState.find((s) => s.storeId === storeId);
    if (!store || !store.fullUrl.trim()) {
      if (!silent) setErrorMsg(t('errors.invalidStoreUrl'));
      return;
    }

    if (!silent) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setScrapingStoreId(storeId);
    }

    try {
      const res = await fetch(
        `/api/variants/${variant.id}/scrape-price`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: store.fullUrl.trim() }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || t('errors.scrapeFailed'));
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
        setSuccessMsg(t('messages.scrapedPriceForStore', { store: store.storeName }));
      }
    } catch (err: any) {
      if (!silent) {
        setErrorMsg(err.message || t('errors.scrapePrice'));
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
      setSuccessMsg(t('messages.scrapedAllStores'));
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || t('errors.scrapeAllStores'));
    } finally {
      setIsScrapingAll(false);
      setScrapingStoreId(null);
    }
  }

  async function handleFetchPhysicalFromGatoArcano() {
    setIsScrapingPhysical(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const gatoArcanoStore = storesState.find((store) => {
      const value = `${store.storeName} ${store.storeBaseUrl} ${store.fullUrl}`.toLowerCase();
      return value.includes('gatoarcano.cl');
    });

    if (!gatoArcanoStore?.fullUrl.trim()) {
      setErrorMsg(t('errors.gatoArcanoUrlMissing'));
      setIsScrapingPhysical(false);
      return;
    }

    try {
      const res = await fetch(`/api/variants/${variant.id}/scrape-physical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: gatoArcanoStore.fullUrl.trim() })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || t('errors.fetchPhysicalAttributes'));
      }

      const result = data.result as {
        weightGrams: number | null;
        widthMm: number | null;
        heightMm: number | null;
        depthMm: number | null;
        packageType: PackagingType | null;
      };

      if (result.weightGrams != null) setWeightGrams(result.weightGrams);
      if (result.widthMm != null) setWidthMm(result.widthMm);
      if (result.heightMm != null) setHeightMm(result.heightMm);
      if (result.depthMm != null) setDepthMm(result.depthMm);
      if (result.packageType != null) setPackageType(result.packageType);

      const updatedLabels: string[] = [];
      if (result.weightGrams != null) updatedLabels.push(t('labels.weight'));
      if (result.widthMm != null || result.heightMm != null || result.depthMm != null) {
        updatedLabels.push(t('labels.dimensions'));
      }
      if (result.packageType != null) updatedLabels.push(t('labels.packaging'));

      if (updatedLabels.length > 0) {
        setSuccessMsg(t('messages.fetchedFromGatoArcano', { fields: updatedLabels.join(', ') }));
      } else {
        setErrorMsg(t('errors.noPhysicalAttributes'));
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('errors.fetchPhysicalAttributes'));
    } finally {
      setIsScrapingPhysical(false);
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
      const res = await fetch(`/api/variants/${variant.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          edition: edition || null,
          language: language || null,
          status,
          activeAtScheduled: status === 'scheduled' && activeAtScheduled
            ? new Date(activeAtScheduled).toISOString()
            : null,
          condition,
          weightGrams,
          widthMm,
          heightMm,
          depthMm,
          packageType,
          storeUrls: storeUrlsPayload,
          prices: prices,
          inventory: inventoryData,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || t('errors.updateVariant'));
      }

      setSuccessMsg(t('messages.variantUpdated'));
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || t('errors.unexpected'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Variant core fields (simplified) */}
      <div className="grid gap-4 sm:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="sku">{t('labels.sku')}</Label>
          <div className="flex gap-2">
            <Input
              id="sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleGenerateSku}
              disabled={isGeneratingSku}
              title={t('labels.autoGenerateSku')}
            >
              {isGeneratingSku ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edition">{t('labels.edition')}</Label>
          <Input
            id="edition"
            value={edition}
            onChange={(e) => setEdition(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="language">{t('labels.language')}</Label>
          <Select
            value={language}
            onValueChange={(val) => setLanguage(val as typeof language)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('placeholders.selectLanguage')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('languageOptions.en')}</SelectItem>
              <SelectItem value="fr">{t('languageOptions.fr')}</SelectItem>
              <SelectItem value="es">{t('languageOptions.es')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="condition">{t('labels.condition')}</Label>
          <Select
            value={condition}
            onValueChange={(val) => setCondition(val as Condition)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('placeholders.selectCondition')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">{t('conditionOptions.new')}</SelectItem>
              <SelectItem value="used">{t('conditionOptions.used')}</SelectItem>
              <SelectItem value="refurbished">{t('conditionOptions.refurbished')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">{t('labels.status')}</Label>
          <Select
            value={status}
            onValueChange={(val) => {
              setStatus(val as VariantStatus);
              if (val !== 'scheduled') setActiveAtScheduled('');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('placeholders.selectStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t('statusOptions.draft')}</SelectItem>
              <SelectItem value="pending_review">{t('statusOptions.pending_review')}</SelectItem>
              <SelectItem value="scheduled">{t('statusOptions.scheduled')}</SelectItem>
              <SelectItem value="active">{t('statusOptions.active')}</SelectItem>
              <SelectItem value="paused">{t('statusOptions.paused')}</SelectItem>
              <SelectItem value="discontinued">{t('statusOptions.discontinued')}</SelectItem>
              <SelectItem value="archived">{t('statusOptions.archived')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Physical Attrs */}

        {status === 'scheduled' && (
          <div className="space-y-2 sm:col-span-1">
            <Label htmlFor="activeAtScheduled">{t('labels.scheduledActivationDate')}</Label>
            <Input
              id="activeAtScheduled"
              type="datetime-local"
              value={activeAtScheduled}
              onChange={(e) => setActiveAtScheduled(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t('scheduledActivationHelp')}
            </p>
          </div>
        )}

        {(variant.activedAt || variant.firstActivedAt) && (
          <div className="sm:col-span-5 flex gap-6 text-xs text-muted-foreground border-t pt-2">
            {variant.firstActivedAt && (
              <span>{t('labels.firstActivated')}: {new Date(variant.firstActivedAt).toLocaleString()}</span>
            )}
            {variant.activedAt && (
              <span>{t('labels.lastActivated')}: {new Date(variant.activedAt).toLocaleString()}</span>
            )}
          </div>
        )}

      </div>

      <div className="space-y-3 border rounded-md p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">{t('sections.physicalAttributes.title')}</h2>
            <p className="text-xs text-muted-foreground">
              {t('sections.physicalAttributes.description')}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isScrapingPhysical}
            onClick={handleFetchPhysicalFromGatoArcano}
          >
            {isScrapingPhysical ? t('buttons.fetching') : t('buttons.fetchFromGatoArcano')}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="weightGrams">{t('labels.weightGrams')}</Label>
            <Input
              id="weightGrams"
              type="number"
              step="10"
              value={weightGrams ?? ''}
              onChange={(e) => setWeightGrams(toNullableNumber(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="widthMm">{t('labels.widthMm')}</Label>
            <Input
              id="widthMm"
              type="number"
              step="1"
              value={widthMm ?? ''}
              onChange={(e) => setWidthMm(toNullableNumber(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="heightMm">{t('labels.heightMm')}</Label>
            <Input
              id="heightMm"
              type="number"
              step="1"
              value={heightMm ?? ''}
              onChange={(e) => setHeightMm(toNullableNumber(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="depthMm">{t('labels.depthMm')}</Label>
            <Input
              id="depthMm"
              type="number"
              step="1"
              value={depthMm ?? ''}
              onChange={(e) => setDepthMm(toNullableNumber(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="packageType">{t('labels.packagingType')}</Label>
            <Select
              value={packageType ? packageType : ''}
              onValueChange={(val) => setPackageType(val as typeof packageType)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('placeholders.selectPackagingType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="box">{t('packagingOptions.box')}</SelectItem>
                <SelectItem value="bag">{t('packagingOptions.bag')}</SelectItem>
                <SelectItem value="tube">{t('packagingOptions.tube')}</SelectItem>
                <SelectItem value="envelope">{t('packagingOptions.envelope')}</SelectItem>
                <SelectItem value="other">{t('packagingOptions.other')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Two-column layout: Store URLs (left) and Variant Prices (right) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Store URLs section */}
        <div className="space-y-3 border rounded-md p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">{t('sections.storeLinks.title')}</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isScrapingAll || storesState.every((s) => !s.fullUrl.trim())}
              onClick={handleScrapeAll}
            >
              {isScrapingAll ? t('buttons.scrapingAll') : t('buttons.scrapeAll')}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('sections.storeLinks.description')}
          </p>

          <div className="space-y-2">
            {storesState.map((store) => (
              <div key={store.storeId} className="space-y-1">
                <Label htmlFor={`store-${store.storeId}`}>
                  {store.storeName}{' '}
                  <span className="text-xs text-muted-foreground">
                    (<Link href={store.storeBaseUrl} target="_blank">{store.storeBaseUrl}</Link>)
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
                    {scrapingStoreId === store.storeId ? t('buttons.scraping') : t('buttons.scrape')}
                  </Button>
                </div>

                {(store.observedPrice != null || store.observedAt) && (
                  <p className="text-xs text-muted-foreground">
                    {t('labels.currentPrice')}:{' '}
                    {store.observedPrice != null
                      ? `${store.observedPrice.toLocaleString('es-CL')} ${store.currency || 'CLP'
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

        <div className="space-y-3">
          {/* Variant Prices Section */}
          <div className="space-y-3 border rounded-md p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">{t('sections.variantPrices.title')}</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddPrice}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('buttons.addPrice')}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('sections.variantPrices.description')}
            </p>

            {prices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t('sections.variantPrices.empty')}
              </p>
            ) : (
              <div className="space-y-3">
                {prices.map((price) => (
                  <div
                    key={price.id}
                    className={`border rounded-md p-3 space-y-3 ${price.active ? 'bg-green-50 border-green-200' : 'bg-gray-50'
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
                          {price.active ? t('status.active') : t('status.inactive')}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {t('labels.priceTypeValue', { type: price.type.charAt(0).toUpperCase() + price.type.slice(1) })}
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
                        <Label htmlFor={`price-amount-${price.id}`}>{t('labels.amount')}</Label>
                        <Input
                          id={`price-amount-${price.id}`}
                          type="number"
                          step="10"
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
                        <Label htmlFor={`price-currency-${price.id}`}>{t('labels.currency')}</Label>
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
                        <Label htmlFor={`price-type-${price.id}`}>{t('labels.priceType')}</Label>
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
                            <SelectItem value="msrp">{t('priceTypeOptions.msrp')}</SelectItem>
                            <SelectItem value="retail">{t('priceTypeOptions.retail')}</SelectItem>
                            <SelectItem value="sale">{t('priceTypeOptions.sale')}</SelectItem>
                            <SelectItem value="member">{t('priceTypeOptions.member')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`price-start-${price.id}`}>
                          {t('labels.startDateOptional')}
                        </Label>
                        <Input
                          id={`price-start-${price.id}`}
                          type="date"
                          value={toDateInputValue(price.startsAt)}
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
                          {t('labels.endDateOptional')}
                        </Label>
                        <Input
                          id={`price-end-${price.id}`}
                          type="date"
                          value={toDateInputValue(price.endsAt)}
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

          {/* Inventory Management Section */}
          <div className="space-y-3 border rounded-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">{t('sections.inventory.title')}</h2>
                <p className="text-xs text-muted-foreground">
                  {t('sections.inventory.description')}
                </p>
              </div>
            </div>

            {locations.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('sections.inventory.noLocations')}
              </p>
            ) : (
              <div className="space-y-3">
                {locations.map((location) => {
                  const available = inventoryData[location.id].onHand - inventoryData[location.id].reserved;
                  return (
                    <div
                      key={location.id}
                      className="border rounded-md p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-sm">{location.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {location.code}
                            {location.region && ` • ${location.region}`}
                          </p>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{t('labels.available')}: </span>
                          <span className={available > 0 ? 'text-green-600' : available < 0 ? 'text-red-600' : ''}>
                            {available}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor={`inventory-onhand-${location.id}`}>
                            {t('labels.onHand')}
                          </Label>
                          <Input
                            id={`inventory-onhand-${location.id}`}
                            type="number"
                            min="0"
                            value={inventoryData[location.id].onHand}
                            onChange={(e) =>
                              setInventoryData((prev) => ({
                                ...prev,
                                [location.id]: {
                                  ...prev[location.id],
                                  onHand: parseInt(e.target.value) || 0,
                                },
                              }))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {t('labels.totalPhysicalStock')}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor={`inventory-reserved-${location.id}`}>
                            {t('labels.reserved')}
                          </Label>
                          <Input
                            id={`inventory-reserved-${location.id}`}
                            type="number"
                            min="0"
                            value={inventoryData[location.id].reserved}
                            onChange={(e) =>
                              setInventoryData((prev) => ({
                                ...prev,
                                [location.id]: {
                                  ...prev[location.id],
                                  reserved: parseInt(e.target.value) || 0,
                                },
                              }))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {t('labels.reservedForOrders')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
      {successMsg && (
        <p className="text-sm text-emerald-600">{successMsg}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? tc('saving') : t('buttons.saveChanges')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}