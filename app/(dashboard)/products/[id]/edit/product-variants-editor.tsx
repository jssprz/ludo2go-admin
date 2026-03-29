'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ProductVariant } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trash2, Package, Plus, Wand2, Loader2 } from 'lucide-react';

type Props = {
  productId: string;
  productSlug: string;
  variants: ProductVariant[];
};

export function ProductVariantsEditor({ productId, productSlug, variants: initialVariants }: Props) {
  const [variants, setVariants] = useState(initialVariants);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New variant dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newEanUpc, setNewEanUpc] = useState('');
  const [newEdition, setNewEdition] = useState('');
  const [newLanguage, setNewLanguage] = useState('es');
  const [newCondition, setNewCondition] = useState('new');
  const [newStatus, setNewStatus] = useState('draft');
  const [newActiveAtScheduled, setNewActiveAtScheduled] = useState('');
  const [newDisplayTitleShort, setNewDisplayTitleShort] = useState('');
  const [newDisplayTitleLong, setNewDisplayTitleLong] = useState('');
  const [newFormat, setNewFormat] = useState('STD');
  const [newBundle, setNewBundle] = useState('');
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);

  function resetNewVariantForm() {
    setNewSku('');
    setNewEanUpc('');
    setNewEdition('');
    setNewLanguage('es');
    setNewCondition('new');
    setNewStatus('draft');
    setNewActiveAtScheduled('');
    setNewDisplayTitleShort('');
    setNewDisplayTitleLong('');
    setNewFormat('STD');
    setNewBundle('');
  }

  async function handleGenerateSku() {
    setIsGeneratingSku(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/variants/generate-sku', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          language: newLanguage,
          edition: newEdition.trim() || null,
          format: newFormat,
          bundle: (newBundle && newBundle !== 'none') ? newBundle : null,
          condition: newCondition,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate SKU');
      }

      setNewSku(data.sku);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate SKU');
    } finally {
      setIsGeneratingSku(false);
    }
  }

  async function handleCreateVariant() {
    if (!newSku.trim()) return;

    setIsCreating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          sku: newSku.trim(),
          eanUpc: newEanUpc.trim() || null,
          edition: newEdition.trim() || null,
          language: newLanguage,
          condition: newCondition,
          status: newStatus,
          activeAtScheduled: newStatus === 'scheduled' && newActiveAtScheduled
            ? new Date(newActiveAtScheduled).toISOString()
            : null,
          displayTitleShort: newDisplayTitleShort.trim() || null,
          displayTitleLong: newDisplayTitleLong.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to create variant');
      }

      const created: ProductVariant = await res.json();
      setVariants([...variants, created]);
      setSuccessMsg(`Variant "${created.sku}" created successfully.`);
      resetNewVariantForm();
      setDialogOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create variant');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteVariant(variantId: string, sku: string) {
    if (!confirm(`Are you sure you want to delete variant "${sku}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingVariantId(variantId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/variants/${variantId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to delete variant');
      }

      setVariants(variants.filter(v => v.id !== variantId));
      setSuccessMsg(`Variant "${sku}" deleted successfully.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete variant');
    } finally {
      setDeletingVariantId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Variants / SKUs</h2>
          <p className="text-sm text-muted-foreground">
            Manage product variants (SKUs, editions, conditions).
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetNewVariantForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add variant
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New variant</DialogTitle>
              <DialogDescription>
                Create a new variant for this product. SKU is required and must be unique.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-sku">SKU *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new-sku"
                      value={newSku}
                      onChange={(e) => setNewSku(e.target.value)}
                      placeholder="e.g. JBY-CATAN-ESSTDNEW-001"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateSku}
                      disabled={isGeneratingSku}
                      title="Auto-generate SKU"
                    >
                      {isGeneratingSku ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JBY-[SLUG]-[LANG][ED][FMT][BND][COND]-[SEQ]
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-ean">EAN / UPC</Label>
                  <Input
                    id="new-ean"
                    value={newEanUpc}
                    onChange={(e) => setNewEanUpc(e.target.value)}
                    placeholder="e.g. 8436017220711"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-edition">Edition / Region</Label>
                  <Input
                    id="new-edition"
                    value={newEdition}
                    onChange={(e) => setNewEdition(e.target.value)}
                    placeholder="e.g. 2nd Edition, Chile, US"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={newFormat} onValueChange={setNewFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STD">Standard</SelectItem>
                      <SelectItem value="DLX">Deluxe</SelectItem>
                      <SelectItem value="TRV">Travel</SelectItem>
                      <SelectItem value="MNI">Mini</SelectItem>
                      <SelectItem value="COL">Collector</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={newLanguage} onValueChange={setNewLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select value={newCondition} onValueChange={setNewCondition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="used">Used</SelectItem>
                      <SelectItem value="refurbished">Refurbished</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bundle</Label>
                  <Select value={newBundle} onValueChange={setNewBundle}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="BND">Bundle</SelectItem>
                      <SelectItem value="B2">Bundle x2</SelectItem>
                      <SelectItem value="B3">Bundle x3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={newStatus}
                    onValueChange={(val) => {
                      setNewStatus(val);
                      if (val !== 'scheduled') setNewActiveAtScheduled('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending_review">Pending Review</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="discontinued">Discontinued</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {newStatus === 'scheduled' && (
                <div className="space-y-2">
                  <Label htmlFor="new-active-at-scheduled">Scheduled activation date</Label>
                  <Input
                    id="new-active-at-scheduled"
                    type="datetime-local"
                    value={newActiveAtScheduled}
                    onChange={(e) => setNewActiveAtScheduled(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The variant will become active automatically at this date &amp; time.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-title-short">Display title (short)</Label>
                  <Input
                    id="new-title-short"
                    value={newDisplayTitleShort}
                    onChange={(e) => setNewDisplayTitleShort(e.target.value)}
                    placeholder="Short display title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-title-long">Display title (long)</Label>
                  <Input
                    id="new-title-long"
                    value={newDisplayTitleLong}
                    onChange={(e) => setNewDisplayTitleLong(e.target.value)}
                    placeholder="Full display title"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateVariant}
                disabled={isCreating || !newSku.trim()}
              >
                {isCreating ? 'Creating...' : 'Create variant'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
      {successMsg && <p className="text-sm text-emerald-600">{successMsg}</p>}

      {variants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Package className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-sm font-medium">No variants yet</h3>
          <p className="text-xs text-muted-foreground mt-1">
            This product has no variants. Add variants to manage different SKUs, editions, and conditions.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {variants.map((v) => (
            <div
              key={v.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded-md px-3 py-2"
            >
              <div className="space-y-0.5">
                <div className="text-sm font-medium">
                  {v.sku}{' '}
                  {v.edition && (
                    <span className="text-xs text-muted-foreground">
                      ({v.edition})
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {v.language ? `${v.language} · ` : ''}
                  {v.status} · {v.condition}
                  {v.status === 'scheduled' && v.activeAtScheduled && (
                    <> · activates {new Date(v.activeAtScheduled).toLocaleString()}</>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/variants/${v.id}/edit`}>
                    Edit variant
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deletingVariantId === v.id}
                  onClick={() => handleDeleteVariant(v.id, v.sku)}
                >
                  {deletingVariantId === v.id ? (
                    'Deleting...'
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
