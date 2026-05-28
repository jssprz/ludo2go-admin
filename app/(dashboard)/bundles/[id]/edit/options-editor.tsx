'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Trash2, Pencil, ChevronUp, ChevronDown, ImagePlus } from 'lucide-react';
import type { BundleOption, VariantRef } from './bundle-editor';

type Props = {
  bundleProductId: string;
  groupId: string;
  initialOptions: BundleOption[];
  onOptionsChangeAction: (options: BundleOption[]) => void;
};

const EMPTY_FORM = {
  label: '',
  description: '',
  variantSearch: '',
  variantId: null as string | null,
  variantRef: null as VariantRef | null,
  priceDelta: '0',
  sortOrder: '0',
  active: true,
};

export function OptionsEditor({ bundleProductId, groupId, initialOptions, onOptionsChangeAction }: Props) {
  const [options, setOptions] = useState<BundleOption[]>(initialOptions);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editingOption, setEditingOption] = useState<BundleOption | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Variant search
  const [variantResults, setVariantResults] = useState<VariantRef[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  function updateOptions(updated: BundleOption[]) {
    setOptions(updated);
    onOptionsChangeAction(updated);
  }

  function replaceOption(updatedOption: BundleOption) {
    const updatedOptions = options.map((option) =>
      option.id === updatedOption.id ? updatedOption : option
    );
    updateOptions(updatedOptions);
    if (editingOption?.id === updatedOption.id) {
      setEditingOption(updatedOption);
    }
  }

  function openCreate() {
    setEditingOption(null);
    setForm({ ...EMPTY_FORM, sortOrder: String(options.length) });
    setVariantResults([]);
    setShowDialog(true);
  }

  function openEdit(opt: BundleOption) {
    setEditingOption(opt);
    setForm({
      label: opt.label,
      description: opt.description ?? '',
      variantSearch: opt.variant ? `${opt.variant.product.name} — ${opt.variant.sku}` : '',
      variantId: opt.variantId,
      variantRef: opt.variant,
      priceDelta: String(opt.priceDelta),
      sortOrder: String(opt.sortOrder),
      active: opt.active,
    });
    setVariantResults([]);
    setShowDialog(true);
  }

  async function searchVariants(q: string) {
    if (!q.trim()) { setVariantResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/variants/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setVariantResults(await res.json());
    } finally {
      setIsSearching(false);
    }
  }

  async function saveOption() {
    if (!form.label) return;
    setIsLoading(true);
    try {
      const payload = {
        label: form.label,
        description: form.description || null,
        variantId: form.variantId || null,
        priceDelta: parseInt(form.priceDelta) || 0,
        sortOrder: parseInt(form.sortOrder) || 0,
        active: form.active,
      };

      if (editingOption) {
        const res = await fetch(
          `/api/bundles/${bundleProductId}/groups/${groupId}/options/${editingOption.id}`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        if (!res.ok) throw new Error(await res.text());
        const updated: BundleOption = await res.json();
        replaceOption(updated);
      } else {
        const res = await fetch(
          `/api/bundles/${bundleProductId}/groups/${groupId}/options`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        if (!res.ok) throw new Error(await res.text());
        const created: BundleOption = await res.json();
        updateOptions([...options, created]);
      }
      setShowDialog(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save option.');
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteOption(opt: BundleOption) {
    if (!confirm(`Delete option "${opt.label}"?`)) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/bundles/${bundleProductId}/groups/${groupId}/options/${opt.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      updateOptions(options.filter((o) => o.id !== opt.id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete option.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImageUpload(file: File) {
    if (!editingOption) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('alt', editingOption.label);

      const uploadRes = await fetch('/api/media', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(error.message || 'Failed to upload image');
      }

      const media = await uploadRes.json();

      const attachRes = await fetch(
        `/api/bundles/${bundleProductId}/groups/${groupId}/options/${editingOption.id}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaId: media.id }),
        }
      );

      if (!attachRes.ok) {
        const error = await attachRes.json();
        throw new Error(error.message || 'Failed to attach image');
      }

      const updatedOption: BundleOption = await attachRes.json();
      replaceOption(updatedOption);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to upload image.');
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function removeImage(mediaId: string) {
    if (!editingOption) return;

    try {
      const res = await fetch(
        `/api/bundles/${bundleProductId}/groups/${groupId}/options/${editingOption.id}/media?mediaId=${mediaId}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to remove image');
      }

      const updatedOption: BundleOption = await res.json();
      replaceOption(updatedOption);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to remove image.');
    }
  }

  async function moveOption(idx: number, direction: 'up' | 'down') {
    const newOpts = [...options];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newOpts.length) return;
    [newOpts[idx], newOpts[swapIdx]] = [newOpts[swapIdx], newOpts[idx]];
    const updated = newOpts.map((o, i) => ({ ...o, sortOrder: i }));
    updateOptions(updated);
    for (const o of updated) {
      fetch(`/api/bundles/${bundleProductId}/groups/${groupId}/options/${o.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: o.sortOrder }),
      }).catch(console.error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Options ({options.length})</p>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Option
        </Button>
      </div>

      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">No options yet.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Order</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Image</TableHead>
                <TableHead>Linked Variant</TableHead>
                <TableHead className="text-right">Price Δ</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {options.map((opt, idx) => (
                <TableRow key={opt.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveOption(idx, 'up')} disabled={idx === 0}>
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveOption(idx, 'down')} disabled={idx === options.length - 1}>
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      {opt.description && <p className="text-xs text-muted-foreground">{opt.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {opt.mediaLinks[0] ? (
                      <div className="flex items-center gap-2">
                        <div className="relative h-10 w-10 overflow-hidden rounded border bg-muted">
                          <Image
                            src={opt.mediaLinks[0].media.thumbUrl || opt.mediaLinks[0].media.url}
                            alt={opt.mediaLinks[0].media.alt || opt.label}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                        {opt.mediaLinks.length > 1 && (
                          <span className="text-xs text-muted-foreground">+{opt.mediaLinks.length - 1}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {opt.variant ? (
                      <span className="text-xs font-mono">{opt.variant.sku}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {opt.priceDelta !== 0 ? (
                      <span className={opt.priceDelta > 0 ? 'text-green-600' : 'text-red-600'}>
                        {opt.priceDelta > 0 ? '+' : ''}{opt.priceDelta}
                      </span>
                    ) : '0'}
                  </TableCell>
                  <TableCell>
                    {opt.active ? (
                      <Badge variant="default" className="text-xs">Yes</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(opt)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteOption(opt)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOption ? 'Edit Option' : 'New Option'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label *</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Catan"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Optional description…"
              />
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>Option Images</Label>
                  <p className="text-xs text-muted-foreground">
                    Upload images after the option exists. Attached images are stored as media assets.
                  </p>
                </div>
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!editingOption || isUploadingImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleImageUpload(file);
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={!editingOption || isUploadingImage} asChild>
                    <span>
                      {isUploadingImage ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="mr-2 h-4 w-4" />
                      )}
                      Upload Image
                    </span>
                  </Button>
                </label>
              </div>

              {!editingOption && (
                <p className="text-xs text-muted-foreground">
                  Save the option first, then reopen it to upload images.
                </p>
              )}

              {editingOption && editingOption.mediaLinks.length > 0 && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {editingOption.mediaLinks.map((mediaLink) => (
                    <div key={mediaLink.mediaId} className="space-y-2">
                      <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                        <Image
                          src={mediaLink.media.thumbUrl || mediaLink.media.url}
                          alt={mediaLink.media.alt || editingOption.label}
                          fill
                          className="object-cover"
                          sizes="160px"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-destructive"
                        onClick={() => removeImage(mediaLink.mediaId)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Linked Variant (optional)</Label>
              <Input
                placeholder="Search by SKU or product name…"
                value={form.variantSearch}
                onChange={(e) => {
                  setForm((f) => ({ ...f, variantSearch: e.target.value, variantId: null, variantRef: null }));
                  searchVariants(e.target.value);
                }}
              />
              {isSearching && <p className="text-xs text-muted-foreground">Searching…</p>}
              {variantResults.length > 0 && (
                <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                  {variantResults.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          variantId: v.id,
                          variantRef: v,
                          variantSearch: `${v.product.name} — ${v.sku}`,
                        }));
                        setVariantResults([]);
                      }}
                    >
                      <span className="font-medium">{v.product.name}</span>
                      <span className="text-muted-foreground ml-2 font-mono">{v.sku}</span>
                    </button>
                  ))}
                </div>
              )}
              {form.variantRef && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{form.variantRef.product.name} — {form.variantRef.sku}</Badge>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => setForm((f) => ({ ...f, variantId: null, variantRef: null, variantSearch: '' }))}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>Price Delta (cents)</Label>
                <Input
                  type="number"
                  value={form.priceDelta}
                  onChange={(e) => setForm((f) => ({ ...f, priceDelta: e.target.value }))}
                  className="w-28"
                />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="w-24"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="opt-active"
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: !!v }))}
              />
              <Label htmlFor="opt-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveOption} disabled={isLoading || !form.label}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingOption ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
