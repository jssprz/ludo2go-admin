'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Play, Plus, Trash2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CatalogMultiSelectPicker,
  CatalogOption,
  VariantMultiSelectPicker,
  stringToTags,
  tagsToString,
} from '../bundles/[id]/edit/variant-selection-rule-editor';

type PriceRule = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  applied: boolean;
  startsAt: string | null;
  endsAt: string | null;
  currency: 'CLP' | 'USD' | 'EUR';
  sourcePriceType: string;
  computationType: 'set_fixed_amount' | 'percentage_discount' | 'fixed_discount';
  fixedAmount: number | null;
  percentageDiscount: string | null;
  fixedDiscountAmount: number | null;
  minResultAmount: number | null;
  productKind: string | null;
  productStatus: string | null;
  variantStatus: string | null;
  requireStock: boolean;
  requiredStockLocationIds: string[];
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
  _count: {
    prices: number;
  };
};

type Props = {
  initialRules: PriceRule[];
};

type RuleFormState = {
  name: string;
  description: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  currency: 'CLP' | 'USD' | 'EUR';
  sourcePriceType: 'msrp' | 'retail' | 'sale' | 'member';
  computationType: 'set_fixed_amount' | 'percentage_discount' | 'fixed_discount';
  fixedAmount: string;
  percentageDiscount: string;
  fixedDiscountAmount: string;
  minResultAmount: string;
  productKind: string;
  productStatus: string;
  variantStatus: string;
  requireStock: boolean;
};

const PRODUCT_KINDS = ['game', 'expansion', 'accessory', 'bundle', 'merch'];
const PRODUCT_STATUSES = ['draft', 'pending_review', 'scheduled', 'active', 'paused', 'discontinued', 'archived'];
const VARIANT_STATUSES = ['draft', 'pending_review', 'scheduled', 'active', 'paused', 'discontinued', 'archived'];

const DEFAULT_FORM: RuleFormState = {
  name: '',
  description: '',
  active: true,
  startsAt: '',
  endsAt: '',
  currency: 'CLP',
  sourcePriceType: 'retail',
  computationType: 'percentage_discount',
  fixedAmount: '',
  percentageDiscount: '',
  fixedDiscountAmount: '',
  minResultAmount: '',
  productKind: '__all__',
  productStatus: '__all__',
  variantStatus: '__all__',
  requireStock: false,
};

function toIsoOrNull(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toNullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function formatDate(dateValue: string | null) {
  if (!dateValue) return '-';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function computationLabel(rule: PriceRule) {
  if (rule.computationType === 'set_fixed_amount') {
    return `Fixed ${rule.fixedAmount ?? '-'} ${rule.currency}`;
  }

  if (rule.computationType === 'fixed_discount') {
    return `-${rule.fixedDiscountAmount ?? '-'} from ${rule.sourcePriceType}`;
  }

  return `${rule.percentageDiscount ?? '0'}% off ${rule.sourcePriceType}`;
}

export function PriceRulesManager({ initialRules }: Props) {
  const router = useRouter();

  const [rules, setRules] = useState<PriceRule[]>(initialRules);
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCatalogOptions, setIsLoadingCatalogOptions] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);

  const [allowedProductIdsStr, setAllowedProductIdsStr] = useState('');
  const [excludedProductIdsStr, setExcludedProductIdsStr] = useState('');
  const [allowedTagsStr, setAllowedTagsStr] = useState('');
  const [excludedTagsStr, setExcludedTagsStr] = useState('');

  const [allowedVariantIds, setAllowedVariantIds] = useState<string[]>([]);
  const [excludedVariantIds, setExcludedVariantIds] = useState<string[]>([]);
  const [allowedVariantSKUs, setAllowedVariantSKUs] = useState<string[]>([]);
  const [excludedVariantSKUs, setExcludedVariantSKUs] = useState<string[]>([]);

  const [allowedGameCategoryIds, setAllowedGameCategoryIds] = useState<string[]>([]);
  const [excludedGameCategoryIds, setExcludedGameCategoryIds] = useState<string[]>([]);
  const [allowedGameThemeIds, setAllowedGameThemeIds] = useState<string[]>([]);
  const [excludedGameThemeIds, setExcludedGameThemeIds] = useState<string[]>([]);
  const [allowedGameMechanicIds, setAllowedGameMechanicIds] = useState<string[]>([]);
  const [excludedGameMechanicIds, setExcludedGameMechanicIds] = useState<string[]>([]);

  const [categories, setCategories] = useState<CatalogOption[]>([]);
  const [themes, setThemes] = useState<CatalogOption[]>([]);
  const [mechanics, setMechanics] = useState<CatalogOption[]>([]);
  const [locations, setLocations] = useState<CatalogOption[]>([]);
  const [requiredStockLocationIds, setRequiredStockLocationIds] = useState<string[]>([]);

  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogOptions() {
      setIsLoadingCatalogOptions(true);
      try {
        const res = await fetch('/api/bundles/rule-options');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setThemes(Array.isArray(data.themes) ? data.themes : []);
        setMechanics(Array.isArray(data.mechanics) ? data.mechanics : []);
        setLocations(
          Array.isArray(data.locations)
            ? data.locations.map((location: { id: string; name: string; code: string }) => ({
                id: location.id,
                name: location.name,
                slug: location.code,
              }))
            : []
        );
      } finally {
        if (!cancelled) {
          setIsLoadingCatalogOptions(false);
        }
      }
    }

    loadCatalogOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  const orderedRules = useMemo(() => {
    return [...rules].sort((a, b) => Number(b.applied) - Number(a.applied));
  }, [rules]);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setAllowedProductIdsStr('');
    setExcludedProductIdsStr('');
    setAllowedTagsStr('');
    setExcludedTagsStr('');
    setAllowedVariantIds([]);
    setExcludedVariantIds([]);
    setAllowedVariantSKUs([]);
    setExcludedVariantSKUs([]);
    setAllowedGameCategoryIds([]);
    setExcludedGameCategoryIds([]);
    setAllowedGameThemeIds([]);
    setExcludedGameThemeIds([]);
    setAllowedGameMechanicIds([]);
    setExcludedGameMechanicIds([]);
    setRequiredStockLocationIds([]);
  }

  async function createRule() {
    if (!form.name.trim()) {
      setError('Rule name is required.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch('/api/prices/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          active: form.active,
          startsAt: toIsoOrNull(form.startsAt),
          endsAt: toIsoOrNull(form.endsAt),
          currency: form.currency,
          sourcePriceType: form.sourcePriceType,
          computationType: form.computationType,
          fixedAmount: toNullableNumber(form.fixedAmount),
          percentageDiscount: toNullableNumber(form.percentageDiscount),
          fixedDiscountAmount: toNullableNumber(form.fixedDiscountAmount),
          minResultAmount: toNullableNumber(form.minResultAmount),
          productKind: form.productKind === '__all__' ? null : form.productKind,
          productStatus: form.productStatus === '__all__' ? null : form.productStatus,
          variantStatus: form.variantStatus === '__all__' ? null : form.variantStatus,
          requireStock: form.requireStock,
          requiredStockLocationIds,
          allowedProductIds: stringToTags(allowedProductIdsStr),
          excludedProductIds: stringToTags(excludedProductIdsStr),
          allowedVariantIds,
          excludedVariantIds,
          allowedVariantSKUs,
          excludedVariantSKUs,
          allowedGameCategoryIds,
          excludedGameCategoryIds,
          allowedGameThemeIds,
          excludedGameThemeIds,
          allowedGameMechanicIds,
          excludedGameMechanicIds,
          allowedTags: stringToTags(allowedTagsStr),
          excludedTags: stringToTags(excludedTagsStr),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create rule');
      }

      setRules((prev) => [data, ...prev]);
      resetForm();
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to create rule');
    } finally {
      setIsSaving(false);
    }
  }

  async function applyRule(ruleId: string) {
    setBusyRuleId(ruleId);
    try {
      const res = await fetch(`/api/prices/rules/${ruleId}/apply`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply rule');
      }

      setRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId
            ? { ...rule, applied: true, _count: { prices: data.createdPrices ?? rule._count.prices } }
            : rule
        )
      );
      router.refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to apply rule');
    } finally {
      setBusyRuleId(null);
    }
  }

  async function unapplyRule(ruleId: string) {
    setBusyRuleId(ruleId);
    try {
      const res = await fetch(`/api/prices/rules/${ruleId}/unapply`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to unapply rule');
      }

      setRules((prev) =>
        prev.map((rule) =>
          rule.id === ruleId ? { ...rule, applied: false, _count: { prices: 0 } } : rule
        )
      );
      router.refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to unapply rule');
    } finally {
      setBusyRuleId(null);
    }
  }

  async function deleteRule(ruleId: string) {
    if (!confirm('Delete this price rule? All generated prices from this rule will be removed.')) {
      return;
    }

    setBusyRuleId(ruleId);
    try {
      const res = await fetch(`/api/prices/rules/${ruleId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete rule');
      }

      setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
      router.refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete rule');
    } finally {
      setBusyRuleId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Price Rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create rule-based prices and apply/unapply them across impacted variants.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Rule Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Winter sale 10%"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(value: RuleFormState['currency']) =>
                  setForm((prev) => ({ ...prev, currency: value }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLP">CLP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Source Price Type</Label>
              <Select
                value={form.sourcePriceType}
                onValueChange={(value: RuleFormState['sourcePriceType']) =>
                  setForm((prev) => ({ ...prev, sourcePriceType: value }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">retail</SelectItem>
                  <SelectItem value="sale">sale</SelectItem>
                  <SelectItem value="member">member</SelectItem>
                  <SelectItem value="msrp">msrp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Computation</Label>
              <Select
                value={form.computationType}
                onValueChange={(value: RuleFormState['computationType']) =>
                  setForm((prev) => ({ ...prev, computationType: value }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage_discount">Percentage Discount</SelectItem>
                  <SelectItem value="fixed_discount">Fixed Discount</SelectItem>
                  <SelectItem value="set_fixed_amount">Set Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Min Result Amount</Label>
              <Input
                type="number"
                min="0"
                value={form.minResultAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, minResultAmount: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Fixed Amount</Label>
              <Input
                type="number"
                min="0"
                value={form.fixedAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, fixedAmount: e.target.value }))}
                placeholder="For set fixed amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Percentage Discount %</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.percentageDiscount}
                onChange={(e) => setForm((prev) => ({ ...prev, percentageDiscount: e.target.value }))}
                placeholder="For percentage discount"
              />
            </div>
            <div className="space-y-2">
              <Label>Fixed Discount Amount</Label>
              <Input
                type="number"
                min="0"
                value={form.fixedDiscountAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, fixedDiscountAmount: e.target.value }))}
                placeholder="For fixed discount"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Starts At</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Ends At</Label>
              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Product Kind</Label>
              <Select
                value={form.productKind}
                onValueChange={(value) => setForm((prev) => ({ ...prev, productKind: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any</SelectItem>
                  {PRODUCT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>{kind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Product Status</Label>
              <Select
                value={form.productStatus}
                onValueChange={(value) => setForm((prev) => ({ ...prev, productStatus: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any</SelectItem>
                  {PRODUCT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Variant Status</Label>
              <Select
                value={form.variantStatus}
                onValueChange={(value) => setForm((prev) => ({ ...prev, variantStatus: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Any</SelectItem>
                  {VARIANT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="rule-active"
                checked={form.active}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, active: Boolean(checked) }))
                }
              />
              <Label htmlFor="rule-active" className="text-xs">Rule Active</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="rule-stock"
                checked={form.requireStock}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, requireStock: Boolean(checked) }))
                }
              />
              <Label htmlFor="rule-stock" className="text-xs">Require Stock</Label>
            </div>
          </div>

          {form.requireStock && (
            <CatalogMultiSelectPicker
              label="Required Stock Locations"
              options={locations}
              selectedIds={requiredStockLocationIds}
              onChange={setRequiredStockLocationIds}
              searchPlaceholder="Search locations by name or code..."
            />
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Allowed Product IDs (comma-separated)</Label>
              <Input
                value={allowedProductIdsStr}
                onChange={(e) => setAllowedProductIdsStr(e.target.value)}
                className="font-mono text-xs"
                placeholder="Leave empty for all"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Excluded Product IDs</Label>
              <Input
                value={excludedProductIdsStr}
                onChange={(e) => setExcludedProductIdsStr(e.target.value)}
                className="font-mono text-xs"
                placeholder="Leave empty for none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <VariantMultiSelectPicker
              label="Allowed Variants (IDs)"
              mode="id"
              selectedValues={allowedVariantIds}
              onChange={setAllowedVariantIds}
            />
            <VariantMultiSelectPicker
              label="Excluded Variants (IDs)"
              mode="id"
              selectedValues={excludedVariantIds}
              onChange={setExcludedVariantIds}
            />
            <VariantMultiSelectPicker
              label="Allowed Variant SKUs"
              mode="sku"
              selectedValues={allowedVariantSKUs}
              onChange={setAllowedVariantSKUs}
            />
            <VariantMultiSelectPicker
              label="Excluded Variant SKUs"
              mode="sku"
              selectedValues={excludedVariantSKUs}
              onChange={setExcludedVariantSKUs}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CatalogMultiSelectPicker
              label="Allowed Game Categories"
              options={categories}
              selectedIds={allowedGameCategoryIds}
              onChange={setAllowedGameCategoryIds}
              searchPlaceholder="Search categories..."
            />
            <CatalogMultiSelectPicker
              label="Excluded Game Categories"
              options={categories}
              selectedIds={excludedGameCategoryIds}
              onChange={setExcludedGameCategoryIds}
              searchPlaceholder="Search categories..."
            />
            <CatalogMultiSelectPicker
              label="Allowed Game Themes"
              options={themes}
              selectedIds={allowedGameThemeIds}
              onChange={setAllowedGameThemeIds}
              searchPlaceholder="Search themes..."
            />
            <CatalogMultiSelectPicker
              label="Excluded Game Themes"
              options={themes}
              selectedIds={excludedGameThemeIds}
              onChange={setExcludedGameThemeIds}
              searchPlaceholder="Search themes..."
            />
            <CatalogMultiSelectPicker
              label="Allowed Game Mechanics"
              options={mechanics}
              selectedIds={allowedGameMechanicIds}
              onChange={setAllowedGameMechanicIds}
              searchPlaceholder="Search mechanics..."
            />
            <CatalogMultiSelectPicker
              label="Excluded Game Mechanics"
              options={mechanics}
              selectedIds={excludedGameMechanicIds}
              onChange={setExcludedGameMechanicIds}
              searchPlaceholder="Search mechanics..."
            />
          </div>

          {isLoadingCatalogOptions && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading catalog options...
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Allowed Tags (comma-separated)</Label>
              <Input
                value={allowedTagsStr}
                onChange={(e) => setAllowedTagsStr(e.target.value)}
                placeholder="e.g. strategy, family"
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Excluded Tags</Label>
              <Input
                value={excludedTagsStr}
                onChange={(e) => setExcludedTagsStr(e.target.value)}
                placeholder="e.g. adult-only"
                className="text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={createRule} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create Rule
            </Button>
            <Button
              variant="outline"
              onClick={resetForm}
              disabled={isSaving}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Price Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Computation</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Generated Prices</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderedRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No price rules yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  orderedRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-muted-foreground">{rule.description}</div>
                        )}
                      </TableCell>
                      <TableCell>{computationLabel(rule)}</TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          <div>From: {formatDate(rule.startsAt)}</div>
                          <div>To: {formatDate(rule.endsAt)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule._count.prices > 0 ? 'default' : 'secondary'}>
                          {rule._count.prices}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {rule.applied ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Applied</Badge>
                          ) : (
                            <Badge variant="secondary">Not Applied</Badge>
                          )}
                          {!rule.active && <Badge variant="outline">Inactive</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {rule.applied ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unapplyRule(rule.id)}
                              disabled={busyRuleId === rule.id}
                            >
                              {busyRuleId === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => applyRule(rule.id)}
                              disabled={busyRuleId === rule.id}
                            >
                              {busyRuleId === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteRule(rule.id)}
                            disabled={busyRuleId === rule.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
