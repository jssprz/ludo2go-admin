'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Pencil, ChevronUp, ChevronDown, Settings } from 'lucide-react';
import { OptionGroupsEditor } from './option-groups-editor';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VariantRef = {
  id: string;
  sku: string;
  product: { name: string };
};

export type OptionMediaAsset = {
  id: string;
  kind: 'image' | 'video' | 'pdf' | 'audio' | 'model3d';
  url: string;
  thumbUrl: string | null;
  alt: string | null;
};

export type BundleOptionMedia = {
  optionId: string;
  mediaId: string;
  role: string | null;
  sort: number;
  media: OptionMediaAsset;
};

export type BundleItemRow = {
  id?: string;
  variantId: string;
  quantity: number;
  variant?: VariantRef;
};

export type VariantSelectionRule = {
  id?: string;
  productKind: string | null;
  productStatus: string | null;
  variantStatus: string | null;
  requireStock: boolean;
  requiredStockLocationIds: string[];
  requireActivePrice: boolean;
  allowedProductIds: string[];
  excludedProductIds: string[];
  allowedVariantIds: string[];
  excludedVariantIds: string[];
  allowedVariantSKUs: string[];
  excludedVariantSKUs: string[];
  allowedGameCategoryIds: string[];
  excludedGameCategoryIds: string[];
  allowedGameThemeIds: string[];
  excludedGameThemeIds: string[];
  allowedGameMechanicIds: string[];
  excludedGameMechanicIds: string[];
  allowedTags: string[];
  excludedTags: string[];
  priceDiscountPercentage: string | null;
  metadata: any;
};

export type AddressSelectionRule = {
  id?: string;
  allowedRegions: string[];
  excludedRegions: string[];
  allowedCities: string[];
  excludedCities: string[];
  requireCityMatch: boolean;
  metadata: any;
};

export type BundleOption = {
  id: string;
  label: string;
  description: string | null;
  variantId: string | null;
  variant: VariantRef | null;
  priceDelta: number;
  sortOrder: number;
  active: boolean;
  mediaLinks: BundleOptionMedia[];
};

export type OptionGroup = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  minSelections: number;
  maxSelections: number;
  required: boolean;
  sortOrder: number;
  active: boolean;
  options: BundleOption[];
  variantSelectionRule: VariantSelectionRule | null;
  addressRule: AddressSelectionRule | null;
};

export type CustomizableDetails = {
  bundleProductId: string;
  pricingMode: string;
  minTotalSelections: number | null;
  maxTotalSelections: number | null;
  instructions: string | null;
  optionGroups: OptionGroup[];
};

export type BundleProduct = {
  id: string;
  name: string;
  slug: string;
  status: string;
  bundle: {
    bundleType: string;
    notes: string | null;
    items: BundleItemRow[];
    customizableDetails: CustomizableDetails | null;
  } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BUNDLE_TYPES = [
  { value: 'game_accessory', label: 'Game + Accessory' },
  { value: 'game_game', label: 'Game + Game' },
  { value: 'accessory_accessory', label: 'Accessory + Accessory' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'custom', label: 'Custom' },
  { value: 'customizable', label: 'Configurable (Customizable)' },
];

const PRICING_MODES = [
  { value: 'fixed_price', label: 'Fixed Price' },
  { value: 'base_plus_options', label: 'Base + Options' },
  { value: 'options_only', label: 'Options Only' },
];

// ─── Component ────────────────────────────────────────────────────────────────

type Props = { product: BundleProduct };

export function BundleEditor({ product }: Props) {
  const router = useRouter();
  const bundle = product.bundle;

  // BundleDetails state
  const [bundleType, setBundleType] = useState(bundle?.bundleType ?? 'custom');
  const [notes, setNotes] = useState(bundle?.notes ?? '');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Configurable details state
  const [pricingMode, setPricingMode] = useState(
    bundle?.customizableDetails?.pricingMode ?? 'base_plus_options'
  );
  const [minTotalSelections, setMinTotalSelections] = useState(
    bundle?.customizableDetails?.minTotalSelections?.toString() ?? ''
  );
  const [maxTotalSelections, setMaxTotalSelections] = useState(
    bundle?.customizableDetails?.maxTotalSelections?.toString() ?? ''
  );
  const [instructions, setInstructions] = useState(
    bundle?.customizableDetails?.instructions ?? ''
  );
  const [isSavingConfigurable, setIsSavingConfigurable] = useState(false);

  // Fixed items state
  const [items, setItems] = useState<BundleItemRow[]>(bundle?.items ?? []);
  const [isSavingItems, setIsSavingItems] = useState(false);

  // Option groups state (passed down to sub-editor)
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>(
    bundle?.customizableDetails?.optionGroups ?? []
  );

  // Variant search for fixed items
  const [variantSearch, setVariantSearch] = useState('');
  const [variantResults, setVariantResults] = useState<VariantRef[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [newItemVariant, setNewItemVariant] = useState<VariantRef | null>(null);
  const [newItemQty, setNewItemQty] = useState('1');

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function saveDetails() {
    setIsSavingDetails(true);
    try {
      const res = await fetch(`/api/bundles/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleType, notes: notes || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to save bundle details.');
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function saveConfigurable() {
    setIsSavingConfigurable(true);
    try {
      const res = await fetch(`/api/bundles/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricingMode,
          minTotalSelections: minTotalSelections ? parseInt(minTotalSelections) : null,
          maxTotalSelections: maxTotalSelections ? parseInt(maxTotalSelections) : null,
          instructions: instructions || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to save configurable details.');
    } finally {
      setIsSavingConfigurable(false);
    }
  }

  async function saveItems() {
    setIsSavingItems(true);
    try {
      const res = await fetch(`/api/bundles/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to save items.');
    } finally {
      setIsSavingItems(false);
    }
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

  function addItem() {
    if (!newItemVariant) return;
    const qty = Math.max(1, parseInt(newItemQty) || 1);
    setItems((prev) => [...prev, { variantId: newItemVariant.id, quantity: qty, variant: newItemVariant }]);
    setShowAddItemDialog(false);
    setNewItemVariant(null);
    setNewItemQty('1');
    setVariantSearch('');
    setVariantResults([]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItemQty(idx: number, qty: number) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: qty } : it));
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isConfigurable = bundleType === 'customizable';

  return (
    <>
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Bundle Details</TabsTrigger>
          <TabsTrigger value="items">Fixed Items ({items.length})</TabsTrigger>
          {isConfigurable && (
            <TabsTrigger value="configurable">Configurable Options</TabsTrigger>
          )}
        </TabsList>

        {/* ── TAB: Bundle Details ─────────────────────────────────────────── */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Bundle Details</CardTitle>
              <CardDescription>Type and internal notes for this bundle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Bundle Type</Label>
                <Select value={bundleType} onValueChange={setBundleType}>
                  <SelectTrigger className="w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUNDLE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {bundleType === 'customizable' && (
                  <p className="text-xs text-muted-foreground">
                    Configurable tab will be available after saving.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Internal Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional internal notes…"
                />
              </div>
              <Button onClick={saveDetails} disabled={isSavingDetails}>
                {isSavingDetails && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Details
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Fixed Items ────────────────────────────────────────────── */}
        <TabsContent value="items">
          <Card>
            <CardHeader>
              <CardTitle>Fixed Items</CardTitle>
              <CardDescription>Variants always included in this bundle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" size="sm" onClick={() => setShowAddItemDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="w-28">Qty</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                          No fixed items.
                        </TableCell>
                      </TableRow>
                    )}
                    {items.map((item, idx) => (
                      <TableRow key={item.variantId + idx}>
                        <TableCell>{item.variant?.product.name ?? '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{item.variant?.sku ?? item.variantId}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItemQty(idx, parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={saveItems} disabled={isSavingItems}>
                {isSavingItems && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Items
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Configurable Options ───────────────────────────────────── */}
        {isConfigurable && (
          <TabsContent value="configurable">
            <div className="space-y-6">
              {/* Configurable Details card */}
              <Card>
                <CardHeader>
                  <CardTitle>Configuration Rules</CardTitle>
                  <CardDescription>Pricing mode and selection constraints.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Pricing Mode</Label>
                    <Select value={pricingMode} onValueChange={setPricingMode}>
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRICING_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-2">
                      <Label>Min Total Selections</Label>
                      <Input
                        type="number"
                        min={0}
                        value={minTotalSelections}
                        onChange={(e) => setMinTotalSelections(e.target.value)}
                        className="w-28"
                        placeholder="—"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Total Selections</Label>
                      <Input
                        type="number"
                        min={0}
                        value={maxTotalSelections}
                        onChange={(e) => setMaxTotalSelections(e.target.value)}
                        className="w-28"
                        placeholder="—"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Instructions (shown to customer)</Label>
                    <Textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={3}
                      placeholder="E.g. Choose 2 games and 1 accessory…"
                    />
                  </div>
                  <Button onClick={saveConfigurable} disabled={isSavingConfigurable}>
                    {isSavingConfigurable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Configuration
                  </Button>
                </CardContent>
              </Card>

              {/* Option groups sub-editor */}
              {bundle?.customizableDetails ? (
                <OptionGroupsEditor
                  bundleProductId={product.id}
                  initialGroups={optionGroups}
                  onGroupsChangeAction={setOptionGroups}
                />
              ) : (
                <Card>
                  <CardContent className="py-6 text-center text-muted-foreground">
                    Save the bundle type as &quot;Configurable&quot; first to manage option groups.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Add Item Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fixed Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search Variant</Label>
              <Input
                placeholder="Search by SKU or product name…"
                value={variantSearch}
                onChange={(e) => {
                  setVariantSearch(e.target.value);
                  searchVariants(e.target.value);
                }}
              />
              {isSearching && <p className="text-xs text-muted-foreground">Searching…</p>}
              {variantResults.length > 0 && (
                <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                  {variantResults.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setNewItemVariant(v);
                        setVariantSearch(`${v.product.name} — ${v.sku}`);
                        setVariantResults([]);
                      }}
                    >
                      <span className="font-medium">{v.product.name}</span>
                      <span className="text-muted-foreground ml-2 font-mono">{v.sku}</span>
                    </button>
                  ))}
                </div>
              )}
              {newItemVariant && (
                <Badge variant="secondary">
                  {newItemVariant.product.name} — {newItemVariant.sku}
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                className="w-28"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>Cancel</Button>
            <Button onClick={addItem} disabled={!newItemVariant}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
