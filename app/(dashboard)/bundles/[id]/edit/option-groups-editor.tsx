'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Loader2, Plus, Trash2, Pencil, ChevronUp, ChevronDown, Settings } from 'lucide-react';
import type { OptionGroup } from './bundle-editor';
import { OptionsEditor } from './options-editor';
import { VariantSelectionRuleEditor } from './variant-selection-rule-editor';

const GROUP_TYPES = [
  { value: 'variant_selection', label: 'Variant Selection' },
  { value: 'fixed_option', label: 'Fixed Option' },
  { value: 'text_input', label: 'Text Input' },
  { value: 'date_input', label: 'Date Input' },
  { value: 'time_slot', label: 'Time Slot' },
  { value: 'boolean', label: 'Boolean (Yes/No)' },
];

const GROUP_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  GROUP_TYPES.map((t) => [t.value, t.label])
);

type Props = {
  bundleProductId: string;
  initialGroups: OptionGroup[];
  onGroupsChangeAction: (groups: OptionGroup[]) => void;
};

const EMPTY_GROUP_FORM = {
  name: '',
  description: '',
  type: 'fixed_option' as string,
  minSelections: '0',
  maxSelections: '1',
  required: false,
  sortOrder: '0',
  active: true,
};

export function OptionGroupsEditor({ bundleProductId, initialGroups, onGroupsChangeAction }: Props) {
  const [groups, setGroups] = useState<OptionGroup[]>(initialGroups);
  const [isLoading, setIsLoading] = useState(false);

  // Create/edit dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<OptionGroup | null>(null);
  const [form, setForm] = useState({ ...EMPTY_GROUP_FORM });

  // Expanded group (for options/rule sub-editors)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  function updateGroups(updated: OptionGroup[]) {
    setGroups(updated);
    onGroupsChangeAction(updated);
  }

  function openCreate() {
    setEditingGroup(null);
    setForm({ ...EMPTY_GROUP_FORM, sortOrder: String(groups.length) });
    setShowDialog(true);
  }

  function openEdit(group: OptionGroup) {
    setEditingGroup(group);
    setForm({
      name: group.name,
      description: group.description ?? '',
      type: group.type,
      minSelections: String(group.minSelections),
      maxSelections: String(group.maxSelections),
      required: group.required,
      sortOrder: String(group.sortOrder),
      active: group.active,
    });
    setShowDialog(true);
  }

  async function saveGroup() {
    if (!form.name) return;
    setIsLoading(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        type: form.type,
        minSelections: parseInt(form.minSelections) || 0,
        maxSelections: parseInt(form.maxSelections) || 1,
        required: form.required,
        sortOrder: parseInt(form.sortOrder) || 0,
        active: form.active,
      };

      if (editingGroup) {
        const res = await fetch(
          `/api/bundles/${bundleProductId}/groups/${editingGroup.id}`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        if (!res.ok) throw new Error(await res.text());
        const updated: OptionGroup = await res.json();
        updateGroups(groups.map((g) => (g.id === editingGroup.id ? { ...updated, options: g.options, variantSelectionRule: g.variantSelectionRule } : g)));
      } else {
        const res = await fetch(
          `/api/bundles/${bundleProductId}/groups`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        );
        if (!res.ok) throw new Error(await res.text());
        const created: OptionGroup = await res.json();
        updateGroups([...groups, created]);
      }
      setShowDialog(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save option group.');
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteGroup(group: OptionGroup) {
    if (!confirm(`Delete group "${group.name}"? This will also delete all options and rules within it.`)) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bundles/${bundleProductId}/groups/${group.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      updateGroups(groups.filter((g) => g.id !== group.id));
      if (expandedGroupId === group.id) setExpandedGroupId(null);
    } catch (err) {
      console.error(err);
      alert('Failed to delete group.');
    } finally {
      setIsLoading(false);
    }
  }

  async function moveGroup(idx: number, direction: 'up' | 'down') {
    const newGroups = [...groups];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newGroups.length) return;
    [newGroups[idx], newGroups[swapIdx]] = [newGroups[swapIdx], newGroups[idx]];
    // Update sortOrders
    const updated = newGroups.map((g, i) => ({ ...g, sortOrder: i }));
    updateGroups(updated);
    // Persist in background
    for (const g of updated) {
      fetch(`/api/bundles/${bundleProductId}/groups/${g.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: g.sortOrder }),
      }).catch(console.error);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Option Groups</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Group
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No option groups yet. Add one to start configuring this bundle.
          </p>
        )}
        {groups.map((group, idx) => (
          <div key={group.id} className="border rounded-lg">
            {/* Group header row */}
            <div className="flex items-center gap-3 p-3">
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveGroup(idx, 'up')} disabled={idx === 0}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveGroup(idx, 'down')} disabled={idx === groups.length - 1}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{group.name}</span>
                  <Badge variant="outline">{GROUP_TYPE_LABELS[group.type] ?? group.type}</Badge>
                  {!group.active && <Badge variant="secondary">Inactive</Badge>}
                  {group.required && <Badge variant="default">Required</Badge>}
                  <span className="text-xs text-muted-foreground">
                    {group.minSelections}–{group.maxSelections} selections
                  </span>
                </div>
                {group.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{group.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(group)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteGroup(group)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            {/* Expanded sub-editor */}
            {expandedGroupId === group.id && (
              <div className="border-t p-4 space-y-4 bg-muted/30">
                {group.type === 'variant_selection' && (
                  <VariantSelectionRuleEditor
                    bundleProductId={bundleProductId}
                    groupId={group.id}
                    initialRule={group.variantSelectionRule}
                    onRuleChangeAction={(rule) =>
                      updateGroups(groups.map((g) => g.id === group.id ? { ...g, variantSelectionRule: rule } : g))
                    }
                  />
                )}
                {group.type === 'fixed_option' && (
                  <OptionsEditor
                    bundleProductId={bundleProductId}
                    groupId={group.id}
                    initialOptions={group.options}
                    onOptionsChangeAction={(opts) =>
                      updateGroups(groups.map((g) => g.id === group.id ? { ...g, options: opts } : g))
                    }
                  />
                )}
                {!['variant_selection', 'fixed_option'].includes(group.type) && (
                  <p className="text-sm text-muted-foreground">
                    This group type ({GROUP_TYPE_LABELS[group.type] ?? group.type}) collects customer input — no additional sub-options needed.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>

      {/* Create/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Option Group' : 'New Option Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Choose a game"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Optional description shown to customer…"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>Min Selections</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.minSelections}
                  onChange={(e) => setForm((f) => ({ ...f, minSelections: e.target.value }))}
                  className="w-24"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Selections</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.maxSelections}
                  onChange={(e) => setForm((f) => ({ ...f, maxSelections: e.target.value }))}
                  className="w-24"
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
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="grp-required"
                  checked={form.required}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, required: !!v }))}
                />
                <Label htmlFor="grp-required">Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="grp-active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, active: !!v }))}
                />
                <Label htmlFor="grp-active">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveGroup} disabled={isLoading || !form.name}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingGroup ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
