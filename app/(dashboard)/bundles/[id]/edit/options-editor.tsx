'use client';

import { useState } from 'react';
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
import { Loader2, Plus, Trash2, Pencil, ChevronUp, ChevronDown } from 'lucide-react';
import type { BundleOption, VariantRef } from './bundle-editor';

type Props = {
  bundleProductId: string;
  groupId: string;
  initialOptions: BundleOption[];
  onOptionsChange: (options: BundleOption[]) => void;
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

export function OptionsEditor({ bundleProductId, groupId, initialOptions, onOptionsChange }: Props) {
  const [options, setOptions] = useState<BundleOption[]>(initialOptions);
  const [isLoading, setIsLoading] = useState(false);

  const [showDialog, setShowDialog] = useState(false);
  const [editingOption, setEditingOption] = useState<BundleOption | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Variant search
  const [variantResults, setVariantResults] = useState<VariantRef[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  function updateOptions(updated: BundleOption[]) {
    setOptions(updated);
    onOptionsChange(updated);
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
        updateOptions(options.map((o) => (o.id === editingOption.id ? updated : o)));
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
