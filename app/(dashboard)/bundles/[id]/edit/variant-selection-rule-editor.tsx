'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Trash2, Search, X } from 'lucide-react';
import type { VariantSelectionRule } from './bundle-editor';

const PRODUCT_KINDS = ['game', 'expansion', 'accessory', 'bundle', 'merch'];
const PRODUCT_STATUSES = ['draft', 'active', 'archived'];
const VARIANT_STATUSES = ['active', 'inactive', 'discontinued'];

type CatalogOption = {
  id: string;
  name: string;
  slug: string;
};

type VariantSearchResult = {
  id: string;
  sku: string;
  product: { name: string };
};

type Props = {
  bundleProductId: string;
  groupId: string;
  initialRule: VariantSelectionRule | null;
  onRuleChangeAction: (rule: VariantSelectionRule | null) => void;
};

const DEFAULT_RULE: VariantSelectionRule = {
  productKind: null,
  productStatus: null,
  variantStatus: null,
  requireStock: true,
  requireActivePrice: true,
  allowedProductIds: [],
  excludedProductIds: [],
  allowedVariantIds: [],
  excludedVariantIds: [],
  allowedVariantSKUs: [],
  excludedVariantSKUs: [],
  allowedGameCategoryIds: [],
  excludedGameCategoryIds: [],
  allowedGameThemeIds: [],
  excludedGameThemeIds: [],
  allowedGameMechanicIds: [],
  excludedGameMechanicIds: [],
  allowedTags: [],
  excludedTags: [],
  priceDiscountPercentage: null,
  metadata: null,
};

function tagsToString(arr: string[]) {
  return arr.join(', ');
}

function stringToTags(str: string) {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type CatalogPickerProps = {
  label: string;
  options: CatalogOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  searchPlaceholder?: string;
};

function CatalogMultiSelectPicker({
  label,
  options,
  selectedIds,
  onChange,
  searchPlaceholder,
}: CatalogPickerProps) {
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.slug.toLowerCase().includes(q)
    );
  }, [options, search]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((v) => v !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder || 'Search...'}
          className="pl-7 text-xs"
        />
      </div>
      <div className="max-h-40 overflow-y-auto rounded border">
        {filteredOptions.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground">No matches</div>
        ) : (
          filteredOptions.map((opt) => {
            const checked = selectedSet.has(opt.id);
            return (
              <button
                type="button"
                key={opt.id}
                onClick={() => toggle(opt.id)}
                className="flex w-full items-center gap-2 border-b px-2 py-1.5 text-left last:border-b-0 hover:bg-muted/50"
              >
                <Checkbox checked={checked} />
                <span className="text-xs">{opt.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{opt.slug}</span>
              </button>
            );
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => {
            const opt = options.find((item) => item.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1 text-xs">
                {opt?.name || id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="rounded p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

type VariantPickerProps = {
  label: string;
  mode: 'id' | 'sku';
  selectedValues: string[];
  onChange: (next: string[]) => void;
};

function VariantMultiSelectPicker({
  label,
  mode,
  selectedValues,
  onChange,
}: VariantPickerProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<VariantSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/variants/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data: VariantSearchResult[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  function getValue(variant: VariantSearchResult) {
    return mode === 'id' ? variant.id : variant.sku;
  }

  function getLabel(variant: VariantSearchResult) {
    return `${variant.product.name} - ${variant.sku}`;
  }

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selectedValues.filter((v) => v !== value));
      return;
    }
    onChange([...selectedValues, value]);
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Type at least 2 characters..."
          className="pl-7 text-xs"
        />
      </div>
      <div className="max-h-40 overflow-y-auto rounded border">
        {isSearching ? (
          <div className="p-2 text-xs text-muted-foreground">Searching...</div>
        ) : results.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground">No results</div>
        ) : (
          results.map((variant) => {
            const value = getValue(variant);
            const checked = selectedSet.has(value);
            return (
              <button
                type="button"
                key={`${mode}-${variant.id}`}
                onClick={() => toggle(value)}
                className="flex w-full items-center gap-2 border-b px-2 py-1.5 text-left last:border-b-0 hover:bg-muted/50"
              >
                <Checkbox checked={checked} />
                <span className="text-xs">{variant.product.name}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{variant.sku}</span>
              </button>
            );
          })
        )}
      </div>
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((value) => {
            const selectedVariant = results.find((item) => getValue(item) === value);
            return (
              <Badge key={value} variant="secondary" className="gap-1 pr-1 text-xs">
                {selectedVariant ? getLabel(selectedVariant) : value}
                <button
                  type="button"
                  onClick={() => toggle(value)}
                  className="rounded p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VariantSelectionRuleEditor({
  bundleProductId,
  groupId,
  initialRule,
  onRuleChangeAction,
}: Props) {
  const [rule, setRule] = useState<VariantSelectionRule>(initialRule ?? DEFAULT_RULE);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCatalogOptions, setIsLoadingCatalogOptions] = useState(false);

  // raw string fields left as plain text
  const [allowedProductIdsStr, setAllowedProductIdsStr] = useState(tagsToString(initialRule?.allowedProductIds ?? []));
  const [excludedProductIdsStr, setExcludedProductIdsStr] = useState(tagsToString(initialRule?.excludedProductIds ?? []));
  const [allowedTagsStr, setAllowedTagsStr] = useState(tagsToString(initialRule?.allowedTags ?? []));
  const [excludedTagsStr, setExcludedTagsStr] = useState(tagsToString(initialRule?.excludedTags ?? []));

  // new picker-driven fields
  const [allowedVariantIds, setAllowedVariantIds] = useState<string[]>(initialRule?.allowedVariantIds ?? []);
  const [excludedVariantIds, setExcludedVariantIds] = useState<string[]>(initialRule?.excludedVariantIds ?? []);
  const [allowedVariantSKUs, setAllowedVariantSKUs] = useState<string[]>(initialRule?.allowedVariantSKUs ?? []);
  const [excludedVariantSKUs, setExcludedVariantSKUs] = useState<string[]>(initialRule?.excludedVariantSKUs ?? []);

  const [allowedGameCategoryIds, setAllowedGameCategoryIds] = useState<string[]>(initialRule?.allowedGameCategoryIds ?? []);
  const [excludedGameCategoryIds, setExcludedGameCategoryIds] = useState<string[]>(initialRule?.excludedGameCategoryIds ?? []);
  const [allowedGameThemeIds, setAllowedGameThemeIds] = useState<string[]>(initialRule?.allowedGameThemeIds ?? []);
  const [excludedGameThemeIds, setExcludedGameThemeIds] = useState<string[]>(initialRule?.excludedGameThemeIds ?? []);
  const [allowedGameMechanicIds, setAllowedGameMechanicIds] = useState<string[]>(initialRule?.allowedGameMechanicIds ?? []);
  const [excludedGameMechanicIds, setExcludedGameMechanicIds] = useState<string[]>(initialRule?.excludedGameMechanicIds ?? []);

  const [categories, setCategories] = useState<CatalogOption[]>([]);
  const [themes, setThemes] = useState<CatalogOption[]>([]);
  const [mechanics, setMechanics] = useState<CatalogOption[]>([]);

  const [priceDiscountPercentage, setPriceDiscountPercentage] = useState(initialRule?.priceDiscountPercentage ?? '');

  useEffect(() => {
    let cancelled = false;

    async function fetchCatalogOptions() {
      setIsLoadingCatalogOptions(true);
      try {
        const res = await fetch('/api/bundles/rule-options');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        setCategories(Array.isArray(data.categories) ? data.categories : []);
        setThemes(Array.isArray(data.themes) ? data.themes : []);
        setMechanics(Array.isArray(data.mechanics) ? data.mechanics : []);
      } finally {
        if (!cancelled) {
          setIsLoadingCatalogOptions(false);
        }
      }
    }

    fetchCatalogOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateRule<K extends keyof VariantSelectionRule>(key: K, value: VariantSelectionRule[K]) {
    setRule((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setIsLoading(true);
    try {
      const payload: VariantSelectionRule = {
        ...rule,
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
        priceDiscountPercentage: priceDiscountPercentage.trim() ? priceDiscountPercentage.trim() : null,
      };

      const res = await fetch(`/api/bundles/${bundleProductId}/groups/${groupId}/rule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());

      const saved: VariantSelectionRule = await res.json();
      setRule(saved);
      onRuleChangeAction(saved);
    } catch (err) {
      console.error(err);
      alert('Failed to save rule.');
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteRule() {
    if (!confirm('Remove this variant selection rule?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bundles/${bundleProductId}/groups/${groupId}/rule`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      setRule(DEFAULT_RULE);
      onRuleChangeAction(null);
    } catch (err) {
      console.error(err);
      alert('Failed to delete rule.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Variant Selection Rule</p>
        {initialRule && (
          <Button variant="ghost" size="sm" onClick={deleteRule} disabled={isLoading}>
            <Trash2 className="mr-1 h-4 w-4 text-destructive" /> Remove Rule
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Define which variants from the catalog are available for this group. Leave filters empty to allow all.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-xs">Product Kind</Label>
          <Select
            value={rule.productKind ?? '__all__'}
            onValueChange={(v) => updateRule('productKind', v === '__all__' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any</SelectItem>
              {PRODUCT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Product Status</Label>
          <Select
            value={rule.productStatus ?? '__all__'}
            onValueChange={(v) => updateRule('productStatus', v === '__all__' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any</SelectItem>
              {PRODUCT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Variant Status</Label>
          <Select
            value={rule.variantStatus ?? '__all__'}
            onValueChange={(v) => updateRule('variantStatus', v === '__all__' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any</SelectItem>
              {VARIANT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="req-stock"
            checked={rule.requireStock}
            onCheckedChange={(v) => updateRule('requireStock', !!v)}
          />
          <Label htmlFor="req-stock" className="text-xs">Require Stock</Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="req-price"
            checked={rule.requireActivePrice}
            onCheckedChange={(v) => updateRule('requireActivePrice', !!v)}
          />
          <Label htmlFor="req-price" className="text-xs">Require Active Price</Label>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Price Discount % (0-100)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={priceDiscountPercentage}
            onChange={(e) => setPriceDiscountPercentage(e.target.value)}
            placeholder="e.g. 10"
            className="w-32"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Allowed Product IDs (comma-separated)</Label>
          <Input
            value={allowedProductIdsStr}
            onChange={(e) => setAllowedProductIdsStr(e.target.value)}
            placeholder="Leave empty for all"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Excluded Product IDs</Label>
          <Input
            value={excludedProductIdsStr}
            onChange={(e) => setExcludedProductIdsStr(e.target.value)}
            placeholder="Leave empty for none"
            className="font-mono text-xs"
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

      <Button size="sm" onClick={save} disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <Save className="mr-2 h-4 w-4" />
        Save Rule
      </Button>
    </div>
  );
}
