'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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
    slug: string;
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
};

type Props = {
  guide: Guide;
};

export function GuideVariantsManager({ guide }: Props) {
  const t = useTranslations('guides');
  const tc = useTranslations('common');
  const [variants, setVariants] = useState<GuideProductVariant[]>(guide.variants);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableVariants, setAvailableVariants] = useState<ProductVariant[]>([]);
  const [variantSearch, setVariantSearch] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<GuideProductVariant | null>(null);

  // Form states
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // Load available variants when dialog opens
    if (showAddDialog) {
      fetchAvailableVariants();
    }
  }, [showAddDialog]);

  async function fetchAvailableVariants() {
    try {
      const res = await fetch('/api/variants');
      if (!res.ok) throw new Error('Failed to fetch variants');
      const data = await res.json();
      setAvailableVariants(data);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tc('error'));
    }
  }

  function getFilteredVariants() {
    return availableVariants.filter((v) => {
      const isAlreadyAdded = variants.some((gv) => gv.variantId === v.id);
      if (isAlreadyAdded) return false;

      if (!variantSearch) return true;
      const searchLower = variantSearch.toLowerCase();
      return (
        v.sku.toLowerCase().includes(searchLower) ||
        v.product.name.toLowerCase().includes(searchLower) ||
        v.product.slug.toLowerCase().includes(searchLower)
      );
    });
  }

  function openDeleteDialog(variant: GuideProductVariant) {
    setSelectedVariant(variant);
    setShowDeleteDialog(true);
  }

  async function handleAdd() {
    if (!selectedVariantId) {
      setFormError(tc('required'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

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
      setVariants([...variants, newVariant]);
      setShowAddDialog(false);
      setSelectedVariantId('');
      setVariantSearch('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tc('error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedVariant) return;

    setIsLoading(true);

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
        variants.filter((v) => v.variantId !== selectedVariant.variantId)
      );
      setShowDeleteDialog(false);
      setSelectedVariant(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc('error'));
    } finally {
      setIsLoading(false);
    }
  }

  const filteredVariants = getFilteredVariants();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('relatedVariants')}</CardTitle>
          <CardDescription>
            {t('relatedVariantsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addVariant')}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
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
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
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
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
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
                  onChange={(e) => setVariantSearch(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            {filteredVariants.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredVariants.map((variant) => (
                  <div
                    key={variant.id}
                    onClick={() => setSelectedVariantId(variant.id)}
                    className={`p-2 border rounded-md cursor-pointer transition-colors ${
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
                  </div>
                ))}
              </div>
            )}

            {variantSearch && filteredVariants.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">
                {tc('noResults')}
              </div>
            )}

            {formError && (
              <div className="text-sm text-destructive">{formError}</div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setSelectedVariantId('');
                setVariantSearch('');
                setFormError(null);
              }}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={handleAdd} disabled={isLoading || !selectedVariantId}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {tc('add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('removeVariant')}</DialogTitle>
            <DialogDescription>
              {t('removeVariantDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button
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
    </div>
  );
}