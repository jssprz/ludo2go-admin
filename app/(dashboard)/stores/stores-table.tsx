'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Pencil,
  Trash2,
  Search,
  Loader2,
  Star,
  ExternalLink,
  X,
} from 'lucide-react';

type Store = {
  id: string;
  name: string;
  logo: string;
  shipping: string;
  shippingCost: number | null;
  url: string;
  rating: number;
  reviews: number;
  paymentMethods: string[];
  createdAt: Date;
  _count: {
    prices: number;
  };
};

type Props = {
  initialStores: Store[];
};

const SHIPPING_OPTIONS = ['free', 'paid', 'pickup'] as const;

const COMMON_PAYMENT_METHODS = [
  'visa',
  'mastercard',
  'amex',
  'paypal',
  'mercadopago',
  'transferencia',
  'efectivo',
  'webpay',
  'flow',
  'khipu',
];

export function StoresTable({ initialStores }: Props) {
  const router = useRouter();
  const t = useTranslations('stores');
  const tc = useTranslations('common');
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formLogo, setFormLogo] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formShipping, setFormShipping] = useState<string>('paid');
  const [formShippingCost, setFormShippingCost] = useState<string>('');
  const [formRating, setFormRating] = useState<string>('0');
  const [formReviews, setFormReviews] = useState<string>('0');
  const [formPaymentMethods, setFormPaymentMethods] = useState<string[]>([]);
  const [formNewPaymentMethod, setFormNewPaymentMethod] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const filteredStores = stores.filter(
    (store) =>
      store.name.toLowerCase().includes(search.toLowerCase()) ||
      store.url.toLowerCase().includes(search.toLowerCase())
  );

  function resetForm() {
    setFormName('');
    setFormLogo('');
    setFormUrl('');
    setFormShipping('paid');
    setFormShippingCost('');
    setFormRating('0');
    setFormReviews('0');
    setFormPaymentMethods([]);
    setFormNewPaymentMethod('');
    setFormError(null);
  }

  function openCreateDialog() {
    resetForm();
    setSelectedStore(null);
    setShowCreateDialog(true);
  }

  function openEditDialog(store: Store) {
    setSelectedStore(store);
    setFormName(store.name);
    setFormLogo(store.logo);
    setFormUrl(store.url);
    setFormShipping(store.shipping);
    setFormShippingCost(store.shippingCost != null ? String(store.shippingCost) : '');
    setFormRating(String(store.rating));
    setFormReviews(String(store.reviews));
    setFormPaymentMethods([...store.paymentMethods]);
    setFormNewPaymentMethod('');
    setFormError(null);
    setShowEditDialog(true);
  }

  function openDeleteDialog(store: Store) {
    setSelectedStore(store);
    setShowDeleteDialog(true);
  }

  function addPaymentMethod(method: string) {
    const trimmed = method.trim().toLowerCase();
    if (trimmed && !formPaymentMethods.includes(trimmed)) {
      setFormPaymentMethods((prev) => [...prev, trimmed]);
    }
    setFormNewPaymentMethod('');
  }

  function removePaymentMethod(method: string) {
    setFormPaymentMethods((prev) => prev.filter((m) => m !== method));
  }

  function buildPayload() {
    return {
      name: formName.trim(),
      logo: formLogo.trim(),
      url: formUrl.trim(),
      shipping: formShipping,
      shippingCost: formShippingCost ? Number(formShippingCost) : null,
      rating: formRating ? Number(formRating) : 0,
      reviews: formReviews ? Number(formReviews) : 0,
      paymentMethods: formPaymentMethods,
    };
  }

  async function handleCreate() {
    if (!formName.trim() || !formUrl.trim()) {
      setFormError(t('nameUrlRequired'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create store');
      }

      setStores((prev) =>
        [...prev, { ...data, _count: { prices: 0 } }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setShowCreateDialog(false);
      resetForm();
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate() {
    if (!selectedStore) return;
    if (!formName.trim() || !formUrl.trim()) {
      setFormError(t('nameUrlRequired'));
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update store');
      }

      setStores((prev) =>
        prev
          .map((s) =>
            s.id === selectedStore.id ? { ...data, _count: s._count } : s
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setShowEditDialog(false);
      resetForm();
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedStore) return;

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/stores/${selectedStore.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete store');
      }

      setStores((prev) => prev.filter((s) => s.id !== selectedStore.id));
      setShowDeleteDialog(false);
      setSelectedStore(null);
      router.refresh();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function renderShippingBadge(shipping: string) {
    switch (shipping) {
      case 'free':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">{t('shippingFree')}</Badge>;
      case 'pickup':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">{t('shippingPickup')}</Badge>;
      default:
        return <Badge variant="outline">{t('shippingPaid')}</Badge>;
    }
  }

  function StoreFormFields() {
    return (
      <div className="grid gap-4 py-4">
        {formError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {formError}
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="store-name">{t('name')} *</Label>
          <Input
            id="store-name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t('namePlaceholder')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="store-url">{t('url')} *</Label>
          <Input
            id="store-url"
            type="url"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder={t('urlPlaceholder')}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="store-logo">{t('logo')}</Label>
          <Input
            id="store-logo"
            value={formLogo}
            onChange={(e) => setFormLogo(e.target.value)}
            placeholder={t('logoPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="store-shipping">{t('shipping')}</Label>
            <Select value={formShipping} onValueChange={setFormShipping}>
              <SelectTrigger id="store-shipping">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIPPING_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(`shipping${opt.charAt(0).toUpperCase() + opt.slice(1)}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formShipping === 'paid' && (
            <div className="grid gap-2">
              <Label htmlFor="store-shipping-cost">{t('shippingCost')}</Label>
              <Input
                id="store-shipping-cost"
                type="number"
                min="0"
                value={formShippingCost}
                onChange={(e) => setFormShippingCost(e.target.value)}
                placeholder="0"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="store-rating">{t('rating')}</Label>
            <Input
              id="store-rating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={formRating}
              onChange={(e) => setFormRating(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="store-reviews">{t('reviews')}</Label>
            <Input
              id="store-reviews"
              type="number"
              min="0"
              value={formReviews}
              onChange={(e) => setFormReviews(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>{t('paymentMethods')}</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {formPaymentMethods.map((method) => (
              <Badge key={method} variant="secondary" className="flex items-center gap-1 pr-1">
                {method}
                <button
                  type="button"
                  onClick={() => removePaymentMethod(method)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Select
              value=""
              onValueChange={(val) => addPaymentMethod(val)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t('selectPaymentMethod')} />
              </SelectTrigger>
              <SelectContent>
                {COMMON_PAYMENT_METHODS.filter(
                  (m) => !formPaymentMethods.includes(m)
                ).map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              value={formNewPaymentMethod}
              onChange={(e) => setFormNewPaymentMethod(e.target.value)}
              placeholder={t('customPaymentMethodPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPaymentMethod(formNewPaymentMethod);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addPaymentMethod(formNewPaymentMethod)}
              disabled={!formNewPaymentMethod.trim()}
            >
              {tc('add')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{t('allStores')}</CardTitle>
              <CardDescription>
                {stores.length} {t('storesTotal', { count: stores.length })}
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addStore')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredStores.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {stores.length === 0 ? t('noStores') : t('noResultsSearch')}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('url')}</TableHead>
                    <TableHead>{t('shipping')}</TableHead>
                    <TableHead className="text-center">{t('rating')}</TableHead>
                    <TableHead className="text-center">{t('reviews')}</TableHead>
                    <TableHead className="text-center">{t('trackedPrices')}</TableHead>
                    <TableHead className="text-center">{t('paymentMethods')}</TableHead>
                    <TableHead className="w-[50px]">
                      <span className="sr-only">{tc('actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {store.logo && (
                            <img
                              src={store.logo}
                              alt={store.name}
                              className="h-6 w-6 rounded object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          {store.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={store.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline text-sm max-w-[200px] truncate"
                        >
                          {new URL(store.url).hostname}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell>{renderShippingBadge(store.shipping)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm">{store.rating.toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {store.reviews}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{store._count.prices}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {store.paymentMethods.slice(0, 3).map((m) => (
                            <Badge key={m} variant="secondary" className="text-xs">
                              {m}
                            </Badge>
                          ))}
                          {store.paymentMethods.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{store.paymentMethods.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">{tc('actions')}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(store)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              {tc('edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => openDeleteDialog(store)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              {tc('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('addStore')}</DialogTitle>
            <DialogDescription>{t('createDescription')}</DialogDescription>
          </DialogHeader>
          <StoreFormFields />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tc('creating')}
                </>
              ) : (
                tc('create')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editStore')}</DialogTitle>
            <DialogDescription>{t('editDescription')}</DialogDescription>
          </DialogHeader>
          <StoreFormFields />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tc('saving')}
                </>
              ) : (
                tc('save')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteConfirmation', { name: selectedStore?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setFormError(null);
              }}
              disabled={isLoading}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tc('deleting')}
                </>
              ) : (
                tc('delete')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
