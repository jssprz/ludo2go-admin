'use client';

import { useState } from 'react';
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
import { Loader2, Save, Trash2 } from 'lucide-react';
import type { VariantSelectionRule } from './bundle-editor';

const PRODUCT_KINDS = ['game', 'expansion', 'accessory', 'bundle', 'merch'];
const PRODUCT_STATUSES = ['draft', 'active', 'archived'];
const VARIANT_STATUSES = ['active', 'inactive', 'discontinued'];

type Props = {
  bundleProductId: string;
  groupId: string;
  initialRule: VariantSelectionRule | null;
  onRuleChange: (rule: VariantSelectionRule | null) => void;
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
  allowedTags: [],
  excludedTags: [],
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

export function VariantSelectionRuleEditor({ bundleProductId, groupId, initialRule, onRuleChange }: Props) {
  const [rule, setRule] = useState<VariantSelectionRule>(initialRule ?? DEFAULT_RULE);
  const [isLoading, setIsLoading] = useState(false);

  // String-form arrays for textarea editing
  const [allowedProductIdsStr, setAllowedProductIdsStr] = useState(tagsToString(initialRule?.allowedProductIds ?? []));
  const [excludedProductIdsStr, setExcludedProductIdsStr] = useState(tagsToString(initialRule?.excludedProductIds ?? []));
  const [allowedVariantIdsStr, setAllowedVariantIdsStr] = useState(tagsToString(initialRule?.allowedVariantIds ?? []));
  const [excludedVariantIdsStr, setExcludedVariantIdsStr] = useState(tagsToString(initialRule?.excludedVariantIds ?? []));
  const [allowedTagsStr, setAllowedTagsStr] = useState(tagsToString(initialRule?.allowedTags ?? []));
  const [excludedTagsStr, setExcludedTagsStr] = useState(tagsToString(initialRule?.excludedTags ?? []));

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
        allowedVariantIds: stringToTags(allowedVariantIdsStr),
        excludedVariantIds: stringToTags(excludedVariantIdsStr),
        allowedTags: stringToTags(allowedTagsStr),
        excludedTags: stringToTags(excludedTagsStr),
      };
      const res = await fetch(`/api/bundles/${bundleProductId}/groups/${groupId}/rule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved: VariantSelectionRule = await res.json();
      setRule(saved);
      onRuleChange(saved);
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
      onRuleChange(null);
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
            <Trash2 className="h-4 w-4 text-destructive mr-1" /> Remove Rule
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Define which variants from the catalog are available for this group. Leave filters empty to allow all.
      </p>

      {/* Filters row */}
      <div className="grid grid-cols-3 gap-4">
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

      {/* Boolean flags */}
      <div className="flex gap-6">
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
      </div>

      {/* Allow/exclude ID lists */}
      <div className="grid grid-cols-2 gap-4">
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
        <div className="space-y-2">
          <Label className="text-xs">Allowed Variant IDs</Label>
          <Input
            value={allowedVariantIdsStr}
            onChange={(e) => setAllowedVariantIdsStr(e.target.value)}
            placeholder="Leave empty for all"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Excluded Variant IDs</Label>
          <Input
            value={excludedVariantIdsStr}
            onChange={(e) => setExcludedVariantIdsStr(e.target.value)}
            placeholder="Leave empty for none"
            className="font-mono text-xs"
          />
        </div>
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
