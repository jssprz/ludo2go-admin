'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Trash2 } from 'lucide-react';
import type { AddressSelectionRule } from './bundle-editor';

type Props = {
  bundleProductId: string;
  groupId: string;
  initialRule: AddressSelectionRule | null;
  onRuleChangeAction: (rule: AddressSelectionRule | null) => void;
};

const DEFAULT_RULE: AddressSelectionRule = {
  allowedRegions: [],
  excludedRegions: [],
  allowedCities: [],
  excludedCities: [],
  requireCityMatch: false,
  metadata: null,
};

function toString(arr: string[]) {
  return arr.join(', ');
}

function toArray(value: string) {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export function AddressRuleEditor({
  bundleProductId,
  groupId,
  initialRule,
  onRuleChangeAction,
}: Props) {
  const [allowedRegionsStr, setAllowedRegionsStr] = useState(toString(initialRule?.allowedRegions ?? []));
  const [excludedRegionsStr, setExcludedRegionsStr] = useState(toString(initialRule?.excludedRegions ?? []));
  const [allowedCitiesStr, setAllowedCitiesStr] = useState(toString(initialRule?.allowedCities ?? []));
  const [excludedCitiesStr, setExcludedCitiesStr] = useState(toString(initialRule?.excludedCities ?? []));
  const [requireCityMatch, setRequireCityMatch] = useState(initialRule?.requireCityMatch ?? false);
  const [isLoading, setIsLoading] = useState(false);

  async function save() {
    setIsLoading(true);
    try {
      const payload: AddressSelectionRule = {
        allowedRegions: toArray(allowedRegionsStr),
        excludedRegions: toArray(excludedRegionsStr),
        allowedCities: toArray(allowedCitiesStr),
        excludedCities: toArray(excludedCitiesStr),
        requireCityMatch,
        metadata: null,
      };

      const res = await fetch(`/api/bundles/${bundleProductId}/groups/${groupId}/address-rule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      const saved: AddressSelectionRule = await res.json();
      onRuleChangeAction(saved);
    } catch (err) {
      console.error(err);
      alert('Failed to save address rule.');
    } finally {
      setIsLoading(false);
    }
  }

  async function removeRule() {
    if (!confirm('Remove this address rule?')) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bundles/${bundleProductId}/groups/${groupId}/address-rule`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());

      onRuleChangeAction(null);
      setAllowedRegionsStr('');
      setExcludedRegionsStr('');
      setAllowedCitiesStr('');
      setExcludedCitiesStr('');
      setRequireCityMatch(false);
    } catch (err) {
      console.error(err);
      alert('Failed to delete address rule.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Address Rule</p>
        {initialRule && (
          <Button variant="ghost" size="sm" onClick={removeRule} disabled={isLoading}>
            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
            Remove Rule
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Limit selectable addresses by region/city. Leave lists empty to allow all values.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Allowed Regions (comma-separated)</Label>
          <Input
            value={allowedRegionsStr}
            onChange={(e) => setAllowedRegionsStr(e.target.value)}
            placeholder="e.g. Metropolitana, Valparaiso"
            className="text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Excluded Regions (comma-separated)</Label>
          <Input
            value={excludedRegionsStr}
            onChange={(e) => setExcludedRegionsStr(e.target.value)}
            placeholder="e.g. Arica y Parinacota"
            className="text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Allowed Cities (comma-separated)</Label>
          <Input
            value={allowedCitiesStr}
            onChange={(e) => setAllowedCitiesStr(e.target.value)}
            placeholder="e.g. Santiago, Vina del Mar"
            className="text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Excluded Cities (comma-separated)</Label>
          <Input
            value={excludedCitiesStr}
            onChange={(e) => setExcludedCitiesStr(e.target.value)}
            placeholder="e.g. Puerto Williams"
            className="text-xs"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="require-city-match"
          checked={requireCityMatch}
          onCheckedChange={(v) => setRequireCityMatch(!!v)}
        />
        <Label htmlFor="require-city-match" className="text-xs">
          Require city to match when region is allowed
        </Label>
      </div>

      <Button size="sm" onClick={save} disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <Save className="mr-2 h-4 w-4" />
        Save Address Rule
      </Button>
    </div>
  );
}