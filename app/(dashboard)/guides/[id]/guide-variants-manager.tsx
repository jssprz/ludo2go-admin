'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getProductSlugs } from '@/lib/guide-blocks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Plus,
  MoreVertical,
  Trash2,
  Loader2,
  Search,
} from 'lucide-react';

type ProductVariant = {
  id: string;
  sku: string;
  product: {
    id: string;
    name: string;
    slug?: string;
  };
};

type GuideProductVariant = {
  guideId: string;
  variantId: string;
  variant: ProductVariant;
};

type Guide = {
  id: string;
  title: string;
  variants: GuideProductVariant[];
  blocks?: { data?: unknown }[];
};

type Props = {
  guide: Guide;
};

export function GuideVariantsManager({ guide }: Props) {
  const router = useRouter();
  const t = useTranslations('guides');
  const tc = useTranslations('common');
  const mutationRef = useRef(false);
  const [variants, setVariants] = useState<GuideProductVariant[]>(guide.variants);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingVariants, setIsSearchingVariants] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableVariants, setAvailableVariants] = useState<ProductVariant[]>([]);
  const [variantSearch, setVariantSearch] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<GuideProductVariant | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Form states
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setVariants(guide.variants);
  }, [guide.id, guide.variants]);

  useEffect(() => {
    if (!showAddDialog) {
      setAvailableVariants([]);
      setVariantSearch('');
      setSelectedVariantId('');
      setFormError(null);
      return;
    }
    void fetchAvailableVariants(variantSearch);
  }, [showAddDialog, variantSearch]);

  async function fetchAvailableVariants(search: string) {
    const query = search.trim();
    if (!query) {
      setAvailableVariants([]);
      return;
    }

    setIsSearchingVariants(true);
    try {
      const params = new URLSearchParams({ q: query });
      const res = await fetch(`/api/variants/search?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch variants');
      const data = await res.json();
      setAvailableVariants(data);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tc('error'));
    } finally {
      setIsSearchingVariants(false);
    }
  }

  function getFilteredVariants() {
    return availableVariants.filter((v) => {
      const isAlreadyAdded = variants.some((gv) => gv.variantId === v.id);
      if (isAlreadyAdded) return false;

      return true;
    });
  }

  function openDeleteDialog(variant: GuideProductVariant) {
    if (mutationRef.current) return;
    setError(null);
    setSelectedVariant(variant);
    setShowDeleteDialog(true);
  }

  async function handleAdd() {
    if (mutationRef.current) return;
    if (!selectedVariantId) {
      setFormError(tc('required'));
      return;
    }

    mutationRef.current = true;
    setIsLoading(true);
    setFormError(null);
    setError(null);

    try {
      const res = await fetch(`/api/guide-product-variants/${guide.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: selectedVariantId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || tc('error'));
      }

      const newVariant = await res.json();
      setVariants((current) => [...current, newVariant]);
      setShowAddDialog(false);
      setSelectedVariantId('');
      setVariantSearch('');
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tc('error'));
    } finally {
      mutationRef.current = false;
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (mutationRef.current || !selectedVariant) return;

    mutationRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/guide-product-variants/${guide.id}?variantId=${selectedVariant.variantId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || tc('error'));
      }

      setVariants(
        (current) => current.filter((variant) => variant.variantId !== selectedVariant.variantId)
      );
      setShowDeleteDialog(false);
      setSelectedVariant(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc('error'));
    } finally {
      mutationRef.current = false;
      setIsLoading(false);
    }
  }

  const filteredVariants = getFilteredVariants();
  const referencedSlugs = new Set(guide.blocks?.flatMap((block) => getProductSlugs(block.data)));
  const unusedLabel = t.has('unusedProductAssociation')
    ? t('unusedProductAssociation')
    : 'Not referenced in content blocks. This association has been kept.';
  const discardTitle = t.has('discardVariantSelection')
    ? t('discardVariantSelection') : 'Discard variant selection?';
  const discardDescription = t.has('discardVariantSelectionDescription')
    ? t('discardVariantSelectionDescription') : 'The selected variant has not been linked yet.';

  function handleAddDialogChange(open: boolean) {
    if (mutationRef.current) return;
    if (!open && selectedVariantId) {
      setShowDiscardDialog(true);
      return;
    }
    setShowAddDialog(open);
  }

  return (
    <div className="space-y-4" aria-busy={isLoading}>
      <Card>
        <CardHeader>
          <CardTitle>{t('relatedVariants')}</CardTitle>
          <CardDescription>
            {t('relatedVariantsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => setShowAddDialog(true)} disabled={isLoading}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addVariant')}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div role="alert" className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {variants.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                {t('noVariants')}
              </p>
            </CardContent>
          </Card>
        ) : (
          variants.map((variant) => (
            <Card key={variant.variantId}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{variant.variant.product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('sku')}: {variant.variant.sku}
                    </div>
                    {guide.blocks && variant.variant.product.slug &&
                      !referencedSlugs.has(variant.variant.product.slug) && (
                        <p className="mt-1 text-sm text-amber-700">{unusedLabel}</p>
                      )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isLoading}
                        aria-label={`${tc('actions')}: ${variant.variant.product.name}`}
                        title={`${tc('actions')}: ${variant.variant.product.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(variant)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {tc('delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={handleAddDialogChange}>
        <DialogContent
          onEscapeKeyDown={(event) => { if (mutationRef.current) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (mutationRef.current) event.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>{t('addVariant')}</DialogTitle>
            <DialogDescription>
              {t('addVariantDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="search">{t('searchVariants')}</Label>
              <div className="flex gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder={t('searchVariantsPlaceholder')}
                  value={variantSearch}
                  disabled={isLoading}
                  onChange={(e) => setVariantSearch(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Type SKU, product name, or edition to search variants.
              </p>
            </div>

            {isSearchingVariants && (
              <div className="text-sm text-muted-foreground text-center py-2">
                Searching variants...
              </div>
            )}

            {!isSearchingVariants && filteredVariants.length > 0 && (
              <div role="radiogroup" aria-label={t('searchVariants')} className="space-y-2 max-h-64 overflow-y-auto">
                {filteredVariants.map((variant) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedVariantId === variant.id}
                    disabled={isLoading}
                    key={variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`w-full p-2 border rounded-md text-left cursor-pointer transition-colors ${
                      selectedVariantId === variant.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {variant.product.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('sku')}: {variant.sku}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {variantSearch && !isSearchingVariants && filteredVariants.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                {tc('noResults')}
              </div>
            )}

            {formError && (
              <div role="alert" className="text-sm text-destructive">{formError}</div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleAddDialogChange(false)}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button type="button" onClick={handleAdd} disabled={isLoading || !selectedVariantId}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tc('add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        if (mutationRef.current) return;
        setShowDeleteDialog(open);
        if (!open) setSelectedVariant(null);
      }}>
        <DialogContent
          onEscapeKeyDown={(event) => { if (mutationRef.current) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (mutationRef.current) event.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>{t('removeVariant')}</DialogTitle>
            <DialogDescription>
              {t('removeVariantDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (mutationRef.current) return;
                setShowDeleteDialog(false);
                setSelectedVariant(null);
              }}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tc('remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{discardTitle}</DialogTitle>
            <DialogDescription>{discardDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDiscardDialog(false)}>
              {tc('cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => {
              setShowDiscardDialog(false);
              setShowAddDialog(false);
            }}>
              {tc('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}