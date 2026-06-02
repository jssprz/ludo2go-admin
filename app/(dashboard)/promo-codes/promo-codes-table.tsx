'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  Loader2,
} from 'lucide-react';

type PromoCodeType = 'percentage' | 'fixed_amount' | 'free_shipping' | 'total_cap';

type PromoCode = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: PromoCodeType;
  percentageOff: string | number | { toString(): string } | null;
  fixedAmountOff: number | null;
  maxPayableAmount: number | null;
  minSubtotal: number | null;
  maxDiscountAmount: number | null;
  active: boolean;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  metadata: unknown;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type Props = {
  initialPromoCodes: PromoCode[];
};

const PROMO_TYPES: Array<{ value: PromoCodeType; label: string }> = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed_amount', label: 'Fixed Amount' },
  { value: 'free_shipping', label: 'Free Shipping' },
  { value: 'total_cap', label: 'Total Cap' },
];

function toDateTimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function toStringValue(value: string | number | { toString(): string } | null | undefined) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

export function PromoCodesTable({ initialPromoCodes }: Props) {
  const router = useRouter();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(initialPromoCodes);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<PromoCodeType>('percentage');
  const [formPercentageOff, setFormPercentageOff] = useState('');
  const [formFixedAmountOff, setFormFixedAmountOff] = useState('');
  const [formMaxPayableAmount, setFormMaxPayableAmount] = useState('');
  const [formMinSubtotal, setFormMinSubtotal] = useState('');
  const [formMaxDiscountAmount, setFormMaxDiscountAmount] = useState('');
  const [formStartsAt, setFormStartsAt] = useState('');
  const [formEndsAt, setFormEndsAt] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState('');
  const [formPerCustomerLimit, setFormPerCustomerLimit] = useState('');
  const [formActive, setFormActive] = useState(true);

  const filteredPromoCodes = useMemo(() => {
    const q = search.toLowerCase();
    return promoCodes.filter(
      (promo) =>
        promo.code.toLowerCase().includes(q) ||
        promo.name.toLowerCase().includes(q) ||
        (promo.description || '').toLowerCase().includes(q)
    );
  }, [promoCodes, search]);

  function resetForm() {
    setFormCode('');
    setFormName('');
    setFormDescription('');
    setFormType('percentage');
    setFormPercentageOff('');
    setFormFixedAmountOff('');
    setFormMaxPayableAmount('');
    setFormMinSubtotal('');
    setFormMaxDiscountAmount('');
    setFormStartsAt('');
    setFormEndsAt('');
    setFormUsageLimit('');
    setFormPerCustomerLimit('');
    setFormActive(true);
    setFormError(null);
  }

  function openCreate() {
    resetForm();
    setShowCreateDialog(true);
  }

  function openEdit(promo: PromoCode) {
    setEditingPromo(promo);
    setFormCode(promo.code);
    setFormName(promo.name);
    setFormDescription(promo.description || '');
    setFormType(promo.type);
    setFormPercentageOff(toStringValue(promo.percentageOff));
    setFormFixedAmountOff(promo.fixedAmountOff?.toString() || '');
    setFormMaxPayableAmount(promo.maxPayableAmount?.toString() || '');
    setFormMinSubtotal(promo.minSubtotal?.toString() || '');
    setFormMaxDiscountAmount(promo.maxDiscountAmount?.toString() || '');
    setFormStartsAt(toDateTimeLocalValue(promo.startsAt));
    setFormEndsAt(toDateTimeLocalValue(promo.endsAt));
    setFormUsageLimit(promo.usageLimit?.toString() || '');
    setFormPerCustomerLimit(promo.perCustomerLimit?.toString() || '');
    setFormActive(promo.active);
    setFormError(null);
    setShowEditDialog(true);
  }

  function buildPayload() {
    return {
      code: formCode.trim(),
      name: formName.trim(),
      description: formDescription.trim() || null,
      type: formType,
      percentageOff: formPercentageOff.trim() || null,
      fixedAmountOff: formFixedAmountOff.trim() || null,
      maxPayableAmount: formMaxPayableAmount.trim() || null,
      minSubtotal: formMinSubtotal.trim() || null,
      maxDiscountAmount: formMaxDiscountAmount.trim() || null,
      startsAt: formStartsAt || null,
      endsAt: formEndsAt || null,
      usageLimit: formUsageLimit.trim() || null,
      perCustomerLimit: formPerCustomerLimit.trim() || null,
      active: formActive,
    };
  }

  async function refreshList() {
    const res = await fetch('/api/promo-codes');
    if (res.ok) {
      const data = await res.json();
      setPromoCodes(data);
    }
  }

  async function handleCreate() {
    if (!formCode.trim() || !formName.trim()) {
      setFormError('Code and name are required');
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/promo-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to create promo code');
      }

      setShowCreateDialog(false);
      resetForm();
      await refreshList();
      router.refresh();
    } catch (error: unknown) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editingPromo) return;
    if (!formCode.trim() || !formName.trim()) {
      setFormError('Code and name are required');
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/promo-codes/${editingPromo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to update promo code');
      }

      setShowEditDialog(false);
      setEditingPromo(null);
      resetForm();
      await refreshList();
      router.refresh();
    } catch (error: unknown) {
      setFormError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(promo: PromoCode) {
    if (!confirm(`Delete promo code ${promo.code}?`)) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/promo-codes/${promo.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete promo code');
      }
      await refreshList();
      router.refresh();
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function renderPrimaryValue(promo: PromoCode) {
    switch (promo.type) {
      case 'percentage':
        return promo.percentageOff != null ? `${promo.percentageOff}%` : '-';
      case 'fixed_amount':
        return promo.fixedAmountOff != null ? `$${promo.fixedAmountOff.toLocaleString()}` : '-';
      case 'total_cap':
        return promo.maxPayableAmount != null ? `$${promo.maxPayableAmount.toLocaleString()}` : '-';
      case 'free_shipping':
        return 'Free shipping';
      default:
        return '-';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search promo codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New Promo Code
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPromoCodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No promo codes found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPromoCodes.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="font-mono text-xs font-semibold">{promo.code}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{promo.name}</p>
                      {promo.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{promo.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{PROMO_TYPES.find((t) => t.value === promo.type)?.label || promo.type}</Badge>
                  </TableCell>
                  <TableCell>{renderPrimaryValue(promo)}</TableCell>
                  <TableCell>
                    {promo.usageCount}
                    {promo.usageLimit != null ? ` / ${promo.usageLimit}` : ''}
                  </TableCell>
                  <TableCell>
                    {promo.active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(promo)}>
                          <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(promo)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Promo Code</DialogTitle>
          </DialogHeader>
          <PromoCodeForm
            formCode={formCode}
            setFormCode={setFormCode}
            formName={formName}
            setFormName={setFormName}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formType={formType}
            setFormType={setFormType}
            formPercentageOff={formPercentageOff}
            setFormPercentageOff={setFormPercentageOff}
            formFixedAmountOff={formFixedAmountOff}
            setFormFixedAmountOff={setFormFixedAmountOff}
            formMaxPayableAmount={formMaxPayableAmount}
            setFormMaxPayableAmount={setFormMaxPayableAmount}
            formMinSubtotal={formMinSubtotal}
            setFormMinSubtotal={setFormMinSubtotal}
            formMaxDiscountAmount={formMaxDiscountAmount}
            setFormMaxDiscountAmount={setFormMaxDiscountAmount}
            formStartsAt={formStartsAt}
            setFormStartsAt={setFormStartsAt}
            formEndsAt={formEndsAt}
            setFormEndsAt={setFormEndsAt}
            formUsageLimit={formUsageLimit}
            setFormUsageLimit={setFormUsageLimit}
            formPerCustomerLimit={formPerCustomerLimit}
            setFormPerCustomerLimit={setFormPerCustomerLimit}
            formActive={formActive}
            setFormActive={setFormActive}
            formError={formError}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isLoading}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit Promo Code</DialogTitle>
          </DialogHeader>
          <PromoCodeForm
            formCode={formCode}
            setFormCode={setFormCode}
            formName={formName}
            setFormName={setFormName}
            formDescription={formDescription}
            setFormDescription={setFormDescription}
            formType={formType}
            setFormType={setFormType}
            formPercentageOff={formPercentageOff}
            setFormPercentageOff={setFormPercentageOff}
            formFixedAmountOff={formFixedAmountOff}
            setFormFixedAmountOff={setFormFixedAmountOff}
            formMaxPayableAmount={formMaxPayableAmount}
            setFormMaxPayableAmount={setFormMaxPayableAmount}
            formMinSubtotal={formMinSubtotal}
            setFormMinSubtotal={setFormMinSubtotal}
            formMaxDiscountAmount={formMaxDiscountAmount}
            setFormMaxDiscountAmount={setFormMaxDiscountAmount}
            formStartsAt={formStartsAt}
            setFormStartsAt={setFormStartsAt}
            formEndsAt={formEndsAt}
            setFormEndsAt={setFormEndsAt}
            formUsageLimit={formUsageLimit}
            setFormUsageLimit={setFormUsageLimit}
            formPerCustomerLimit={formPerCustomerLimit}
            setFormPerCustomerLimit={setFormPerCustomerLimit}
            formActive={formActive}
            setFormActive={setFormActive}
            formError={formError}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isLoading}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type FormProps = {
  formCode: string;
  setFormCode: (v: string) => void;
  formName: string;
  setFormName: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formType: PromoCodeType;
  setFormType: (v: PromoCodeType) => void;
  formPercentageOff: string;
  setFormPercentageOff: (v: string) => void;
  formFixedAmountOff: string;
  setFormFixedAmountOff: (v: string) => void;
  formMaxPayableAmount: string;
  setFormMaxPayableAmount: (v: string) => void;
  formMinSubtotal: string;
  setFormMinSubtotal: (v: string) => void;
  formMaxDiscountAmount: string;
  setFormMaxDiscountAmount: (v: string) => void;
  formStartsAt: string;
  setFormStartsAt: (v: string) => void;
  formEndsAt: string;
  setFormEndsAt: (v: string) => void;
  formUsageLimit: string;
  setFormUsageLimit: (v: string) => void;
  formPerCustomerLimit: string;
  setFormPerCustomerLimit: (v: string) => void;
  formActive: boolean;
  setFormActive: (v: boolean) => void;
  formError: string | null;
};

function PromoCodeForm(props: FormProps) {
  const {
    formCode, setFormCode,
    formName, setFormName,
    formDescription, setFormDescription,
    formType, setFormType,
    formPercentageOff, setFormPercentageOff,
    formFixedAmountOff, setFormFixedAmountOff,
    formMaxPayableAmount, setFormMaxPayableAmount,
    formMinSubtotal, setFormMinSubtotal,
    formMaxDiscountAmount, setFormMaxDiscountAmount,
    formStartsAt, setFormStartsAt,
    formEndsAt, setFormEndsAt,
    formUsageLimit, setFormUsageLimit,
    formPerCustomerLimit, setFormPerCustomerLimit,
    formActive, setFormActive,
    formError,
  } = props;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Code *</Label>
        <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="WELCOME10" />
      </div>
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Welcome discount" />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Description</Label>
        <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
      </div>

      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={formType} onValueChange={(v) => setFormType(v as PromoCodeType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROMO_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Percentage Off</Label>
        <Input type="number" step="0.01" value={formPercentageOff} onChange={(e) => setFormPercentageOff(e.target.value)} placeholder="10" disabled={formType !== 'percentage'} />
      </div>

      <div className="space-y-2">
        <Label>Fixed Amount Off</Label>
        <Input type="number" value={formFixedAmountOff} onChange={(e) => setFormFixedAmountOff(e.target.value)} placeholder="5000" disabled={formType !== 'fixed_amount'} />
      </div>

      <div className="space-y-2">
        <Label>Max Payable Amount</Label>
        <Input type="number" value={formMaxPayableAmount} onChange={(e) => setFormMaxPayableAmount(e.target.value)} placeholder="20000" disabled={formType !== 'total_cap'} />
      </div>

      <div className="space-y-2">
        <Label>Min Subtotal</Label>
        <Input type="number" value={formMinSubtotal} onChange={(e) => setFormMinSubtotal(e.target.value)} placeholder="0" />
      </div>

      <div className="space-y-2">
        <Label>Max Discount Amount</Label>
        <Input type="number" value={formMaxDiscountAmount} onChange={(e) => setFormMaxDiscountAmount(e.target.value)} placeholder="10000" />
      </div>

      <div className="space-y-2">
        <Label>Starts At</Label>
        <Input type="datetime-local" value={formStartsAt} onChange={(e) => setFormStartsAt(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Ends At</Label>
        <Input type="datetime-local" value={formEndsAt} onChange={(e) => setFormEndsAt(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Usage Limit</Label>
        <Input type="number" value={formUsageLimit} onChange={(e) => setFormUsageLimit(e.target.value)} placeholder="100" />
      </div>

      <div className="space-y-2">
        <Label>Per Customer Limit</Label>
        <Input type="number" value={formPerCustomerLimit} onChange={(e) => setFormPerCustomerLimit(e.target.value)} placeholder="1" />
      </div>

      <div className="flex items-center gap-2 md:col-span-2">
        <input
          id="promo-active"
          type="checkbox"
          checked={formActive}
          onChange={(e) => setFormActive(e.target.checked)}
          className="h-4 w-4 rounded border"
        />
        <Label htmlFor="promo-active">Active</Label>
      </div>

      {formError && (
        <p className="text-sm text-destructive md:col-span-2">{formError}</p>
      )}
    </div>
  );
}
