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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Sparkles,
  Tag,
  Copy,
  Play,
  Pause,
  AlertCircle,
  X,
} from 'lucide-react';

type PromotionStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
type PromotionActivationMode = 'AUTOMATIC' | 'PROMO_CODE';

type PromoCodeSummary = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  promotionLink?: {
    promotionId: string;
  } | null;
};

type Promotion = {
  id: string;
  name: string;
  description: string | null;
  status: PromotionStatus;
  activationMode: PromotionActivationMode;
  conditions: any;
  benefits: any;
  applicationPolicy: any;
  combinationPolicy: any;
  currency: string;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  priority: number;
  version: number;
  usageLimit: number | null;
  usageCount: number;
  perCustomerLimit: number | null;
  metadata: any;
  createdAt: string | Date;
  updatedAt: string | Date;
  promoCodeLinks: Array<{
    promoCode: {
      id: string;
      code: string;
      name: string;
      active: boolean;
    };
  }>;
  _count?: {
    applications: number;
  };
};

type Props = {
  initialPromotions: Promotion[];
  allPromoCodes: PromoCodeSummary[];
};

const STATUS_OPTIONS: Array<{ value: PromotionStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const STATUS_BADGE_CLASSES: Record<PromotionStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  DRAFT: 'bg-gray-100 text-gray-800 border-gray-300',
  PAUSED: 'bg-amber-100 text-amber-800 border-amber-300',
  ARCHIVED: 'bg-rose-100 text-rose-800 border-rose-300',
};

function formatCurrency(amount: number, currency: string = 'CLP') {
  return new Intl.NumberFormat(currency === 'CLP' ? 'es-CL' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(amount);
}

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

function formatBenefitSummary(benefits: any, currency = 'CLP'): string {
  if (!benefits || typeof benefits !== 'object') return '—';
  const type = benefits.type;
  if (type === 'percentage') {
    const pct = benefits.percentage != null ? `${benefits.percentage}% off` : 'Percentage off';
    const applies = benefits.appliesTo ? ` · ${String(benefits.appliesTo).replace(/_/g, ' ')}` : '';
    return `${pct}${applies}`;
  }
  if (type === 'fixed_amount') {
    const amt = benefits.amount != null ? `${formatCurrency(Number(benefits.amount), currency)} off` : 'Fixed discount';
    const applies = benefits.appliesTo ? ` · ${String(benefits.appliesTo).replace(/_/g, ' ')}` : '';
    return `${amt}${applies}`;
  }
  if (type === 'free_shipping') {
    return 'Free Shipping';
  }
  return JSON.stringify(benefits).slice(0, 30);
}

export function PromotionsTable({ initialPromotions, allPromoCodes }: Props) {
  const router = useRouter();
  const [promotions, setPromotions] = useState<Promotion[]>(initialPromotions);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [showDialog, setShowDialog] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<PromotionStatus>('ACTIVE');
  const [formActivationMode, setFormActivationMode] = useState<PromotionActivationMode>('AUTOMATIC');
  const [formCurrency, setFormCurrency] = useState('CLP');
  const [formPriority, setFormPriority] = useState('0');
  const [formStartsAt, setFormStartsAt] = useState('');
  const [formEndsAt, setFormEndsAt] = useState('');
  const [formUsageLimit, setFormUsageLimit] = useState('');
  const [formPerCustomerLimit, setFormPerCustomerLimit] = useState('');

  // Selected Promo Code IDs for PROMO_CODE mode
  const [selectedPromoCodeIds, setSelectedPromoCodeIds] = useState<string[]>([]);

  // Visual Rule Builder state
  const [ruleTab, setRuleTab] = useState<'visual' | 'json'>('visual');
  const [benefitType, setBenefitType] = useState<'percentage' | 'fixed_amount' | 'free_shipping' | 'custom'>('percentage');
  const [benefitPercentage, setBenefitPercentage] = useState('50');
  const [benefitAmount, setBenefitAmount] = useState('5000');
  const [benefitAppliesTo, setBenefitAppliesTo] = useState('second_eligible_item');
  const [benefitMaxDiscount, setBenefitMaxDiscount] = useState('');

  const [condMinSubtotal, setCondMinSubtotal] = useState('');
  const [condMinQuantity, setCondMinQuantity] = useState('2');
  const [condProductTags, setCondProductTags] = useState('games');

  const [policyMaxPerOrder, setPolicyMaxPerOrder] = useState('1');
  const [policyCombinable, setPolicyCombinable] = useState(false);

  // Raw JSON fields state
  const [jsonConditions, setJsonConditions] = useState('{}');
  const [jsonBenefits, setJsonBenefits] = useState('{}');
  const [jsonApplicationPolicy, setJsonApplicationPolicy] = useState('{}');
  const [jsonCombinationPolicy, setJsonCombinationPolicy] = useState('{"combinable": false}');
  const [jsonMetadata, setJsonMetadata] = useState('');

  const filteredPromotions = useMemo(() => {
    const q = search.toLowerCase();
    return promotions.filter((promo) => {
      const matchesSearch =
        !q ||
        promo.name.toLowerCase().includes(q) ||
        (promo.description || '').toLowerCase().includes(q) ||
        promo.promoCodeLinks.some((l) => l.promoCode.code.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || promo.status === statusFilter;
      const matchesMode = modeFilter === 'all' || promo.activationMode === modeFilter;

      return matchesSearch && matchesStatus && matchesMode;
    });
  }, [promotions, search, statusFilter, modeFilter]);

  function syncVisualToJson() {
    // Generate benefits
    let benefitsObj: any = {};
    if (benefitType === 'percentage') {
      benefitsObj = {
        type: 'percentage',
        percentage: Number(benefitPercentage) || 0,
        appliesTo: benefitAppliesTo || 'order',
      };
      if (benefitMaxDiscount) {
        benefitsObj.maxDiscountAmount = Number(benefitMaxDiscount);
      }
    } else if (benefitType === 'fixed_amount') {
      benefitsObj = {
        type: 'fixed_amount',
        amount: Number(benefitAmount) || 0,
        appliesTo: benefitAppliesTo || 'order',
      };
    } else if (benefitType === 'free_shipping') {
      benefitsObj = {
        type: 'free_shipping',
        appliesTo: 'shipping',
      };
    } else {
      try {
        benefitsObj = JSON.parse(jsonBenefits);
      } catch {
        benefitsObj = {};
      }
    }
    setJsonBenefits(JSON.stringify(benefitsObj, null, 2));

    // Generate conditions
    const conditionsObj: any = {};
    if (condMinQuantity) {
      conditionsObj.minimumQuantity = Number(condMinQuantity);
    }
    if (condMinSubtotal) {
      conditionsObj.minimumSubtotal = Number(condMinSubtotal);
    }
    const tagsArray = condProductTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tagsArray.length > 0) {
      conditionsObj.productTags = tagsArray;
    }
    setJsonConditions(JSON.stringify(conditionsObj, null, 2));

    // Generate application policy
    const appPolicyObj: any = {};
    if (policyMaxPerOrder) {
      appPolicyObj.maxApplicationsPerOrder = Number(policyMaxPerOrder);
    }
    setJsonApplicationPolicy(JSON.stringify(appPolicyObj, null, 2));

    // Generate combination policy
    const combPolicyObj = { combinable: policyCombinable };
    setJsonCombinationPolicy(JSON.stringify(combPolicyObj, null, 2));
  }

  function syncJsonToVisual(condStr: string, benStr: string, appStr: string, combStr: string) {
    try {
      const ben = JSON.parse(benStr || '{}');
      if (ben.type === 'percentage') {
        setBenefitType('percentage');
        setBenefitPercentage(ben.percentage != null ? String(ben.percentage) : '');
        setBenefitAppliesTo(ben.appliesTo || 'order');
        setBenefitMaxDiscount(ben.maxDiscountAmount != null ? String(ben.maxDiscountAmount) : '');
      } else if (ben.type === 'fixed_amount') {
        setBenefitType('fixed_amount');
        setBenefitAmount(ben.amount != null ? String(ben.amount) : '');
        setBenefitAppliesTo(ben.appliesTo || 'order');
      } else if (ben.type === 'free_shipping') {
        setBenefitType('free_shipping');
        setBenefitAppliesTo('shipping');
      } else {
        setBenefitType('custom');
      }
    } catch {
      setBenefitType('custom');
    }

    try {
      const cond = JSON.parse(condStr || '{}');
      setCondMinQuantity(cond.minimumQuantity != null ? String(cond.minimumQuantity) : '');
      setCondMinSubtotal(cond.minimumSubtotal != null ? String(cond.minimumSubtotal) : '');
      setCondProductTags(Array.isArray(cond.productTags) ? cond.productTags.join(', ') : '');
    } catch {
      // ignore
    }

    try {
      const app = JSON.parse(appStr || '{}');
      setPolicyMaxPerOrder(app.maxApplicationsPerOrder != null ? String(app.maxApplicationsPerOrder) : '');
    } catch {
      // ignore
    }

    try {
      const comb = JSON.parse(combStr || '{}');
      setPolicyCombinable(Boolean(comb.combinable));
    } catch {
      // ignore
    }
  }

  function openCreateDialog() {
    setEditingPromotion(null);
    setFormError(null);
    setRuleTab('visual');

    setFormName('');
    setFormDescription('');
    setFormStatus('ACTIVE');
    setFormActivationMode('AUTOMATIC');
    setFormCurrency('CLP');
    setFormPriority('0');
    setFormStartsAt('');
    setFormEndsAt('');
    setFormUsageLimit('');
    setFormPerCustomerLimit('');
    setSelectedPromoCodeIds([]);

    setBenefitType('percentage');
    setBenefitPercentage('50');
    setBenefitAmount('5000');
    setBenefitAppliesTo('second_eligible_item');
    setBenefitMaxDiscount('');

    setCondMinQuantity('2');
    setCondMinSubtotal('');
    setCondProductTags('games');

    setPolicyMaxPerOrder('1');
    setPolicyCombinable(false);

    setJsonConditions(JSON.stringify({ minimumQuantity: 2, productTags: ['games'] }, null, 2));
    setJsonBenefits(JSON.stringify({ type: 'percentage', percentage: 50, appliesTo: 'second_eligible_item' }, null, 2));
    setJsonApplicationPolicy(JSON.stringify({ maxApplicationsPerOrder: 1 }, null, 2));
    setJsonCombinationPolicy(JSON.stringify({ combinable: false }, null, 2));
    setJsonMetadata('');

    setShowDialog(true);
  }

  function openEditDialog(promo: Promotion) {
    setEditingPromotion(promo);
    setFormError(null);
    setRuleTab('visual');

    setFormName(promo.name);
    setFormDescription(promo.description || '');
    setFormStatus(promo.status);
    setFormActivationMode(promo.activationMode);
    setFormCurrency(promo.currency || 'CLP');
    setFormPriority(String(promo.priority ?? 0));
    setFormStartsAt(toDateTimeLocalValue(promo.startsAt));
    setFormEndsAt(toDateTimeLocalValue(promo.endsAt));
    setFormUsageLimit(promo.usageLimit != null ? String(promo.usageLimit) : '');
    setFormPerCustomerLimit(promo.perCustomerLimit != null ? String(promo.perCustomerLimit) : '');
    setSelectedPromoCodeIds(promo.promoCodeLinks.map((l) => l.promoCode.id));

    const condStr = JSON.stringify(promo.conditions || {}, null, 2);
    const benStr = JSON.stringify(promo.benefits || {}, null, 2);
    const appStr = JSON.stringify(promo.applicationPolicy || {}, null, 2);
    const combStr = JSON.stringify(promo.combinationPolicy || { combinable: false }, null, 2);
    const metaStr = promo.metadata ? JSON.stringify(promo.metadata, null, 2) : '';

    setJsonConditions(condStr);
    setJsonBenefits(benStr);
    setJsonApplicationPolicy(appStr);
    setJsonCombinationPolicy(combStr);
    setJsonMetadata(metaStr);

    syncJsonToVisual(condStr, benStr, appStr, combStr);

    setShowDialog(true);
  }

  function openDuplicateDialog(promo: Promotion) {
    setEditingPromotion(null);
    setFormError(null);
    setRuleTab('visual');

    setFormName(`Copy of ${promo.name}`);
    setFormDescription(promo.description || '');
    setFormStatus('DRAFT');
    setFormActivationMode(promo.activationMode);
    setFormCurrency(promo.currency || 'CLP');
    setFormPriority(String(promo.priority ?? 0));
    setFormStartsAt('');
    setFormEndsAt('');
    setFormUsageLimit(promo.usageLimit != null ? String(promo.usageLimit) : '');
    setFormPerCustomerLimit(promo.perCustomerLimit != null ? String(promo.perCustomerLimit) : '');
    setSelectedPromoCodeIds([]); // don't duplicate promo code link since codes are unique

    const condStr = JSON.stringify(promo.conditions || {}, null, 2);
    const benStr = JSON.stringify(promo.benefits || {}, null, 2);
    const appStr = JSON.stringify(promo.applicationPolicy || {}, null, 2);
    const combStr = JSON.stringify(promo.combinationPolicy || { combinable: false }, null, 2);
    const metaStr = promo.metadata ? JSON.stringify(promo.metadata, null, 2) : '';

    setJsonConditions(condStr);
    setJsonBenefits(benStr);
    setJsonApplicationPolicy(appStr);
    setJsonCombinationPolicy(combStr);
    setJsonMetadata(metaStr);

    syncJsonToVisual(condStr, benStr, appStr, combStr);

    setShowDialog(true);
  }

  async function handleSavePromotion() {
    if (!formName.trim()) {
      setFormError('Promotion name is required');
      return;
    }

    // Determine payload JSON
    let conditionsObj: any;
    let benefitsObj: any;
    let applicationPolicyObj: any;
    let combinationPolicyObj: any;
    let metadataObj: any = null;

    if (ruleTab === 'visual') {
      // Build objects from visual builder
      if (benefitType === 'percentage') {
        benefitsObj = {
          type: 'percentage',
          percentage: Number(benefitPercentage) || 0,
          appliesTo: benefitAppliesTo || 'order',
        };
        if (benefitMaxDiscount) {
          benefitsObj.maxDiscountAmount = Number(benefitMaxDiscount);
        }
      } else if (benefitType === 'fixed_amount') {
        benefitsObj = {
          type: 'fixed_amount',
          amount: Number(benefitAmount) || 0,
          appliesTo: benefitAppliesTo || 'order',
        };
      } else if (benefitType === 'free_shipping') {
        benefitsObj = {
          type: 'free_shipping',
          appliesTo: 'shipping',
        };
      } else {
        try {
          benefitsObj = JSON.parse(jsonBenefits);
        } catch {
          setFormError('Invalid JSON in Benefits');
          return;
        }
      }

      conditionsObj = {};
      if (condMinQuantity) conditionsObj.minimumQuantity = Number(condMinQuantity);
      if (condMinSubtotal) conditionsObj.minimumSubtotal = Number(condMinSubtotal);
      const tags = condProductTags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tags.length > 0) conditionsObj.productTags = tags;

      applicationPolicyObj = {};
      if (policyMaxPerOrder) applicationPolicyObj.maxApplicationsPerOrder = Number(policyMaxPerOrder);

      combinationPolicyObj = { combinable: policyCombinable };

      if (jsonMetadata.trim()) {
        try {
          metadataObj = JSON.parse(jsonMetadata);
        } catch {
          setFormError('Invalid JSON in Metadata');
          return;
        }
      }
    } else {
      // Validate JSON strings
      try {
        conditionsObj = JSON.parse(jsonConditions || '{}');
      } catch {
        setFormError('Invalid JSON in Conditions');
        return;
      }
      try {
        benefitsObj = JSON.parse(jsonBenefits || '{}');
      } catch {
        setFormError('Invalid JSON in Benefits');
        return;
      }
      try {
        applicationPolicyObj = JSON.parse(jsonApplicationPolicy || '{}');
      } catch {
        setFormError('Invalid JSON in Application Policy');
        return;
      }
      try {
        combinationPolicyObj = JSON.parse(jsonCombinationPolicy || '{"combinable": false}');
      } catch {
        setFormError('Invalid JSON in Combination Policy');
        return;
      }
      if (jsonMetadata.trim()) {
        try {
          metadataObj = JSON.parse(jsonMetadata);
        } catch {
          setFormError('Invalid JSON in Metadata');
          return;
        }
      }
    }

    const payload = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      status: formStatus,
      activationMode: formActivationMode,
      currency: formCurrency.trim() || 'CLP',
      priority: Number(formPriority) || 0,
      startsAt: formStartsAt ? new Date(formStartsAt).toISOString() : null,
      endsAt: formEndsAt ? new Date(formEndsAt).toISOString() : null,
      usageLimit: formUsageLimit ? Number(formUsageLimit) : null,
      perCustomerLimit: formPerCustomerLimit ? Number(formPerCustomerLimit) : null,
      conditions: conditionsObj,
      benefits: benefitsObj,
      applicationPolicy: applicationPolicyObj,
      combinationPolicy: combinationPolicyObj,
      metadata: metadataObj,
      promoCodeIds: formActivationMode === 'PROMO_CODE' ? selectedPromoCodeIds : [],
    };

    setIsLoading(true);
    setFormError(null);

    try {
      const url = editingPromotion ? `/api/promotions/${editingPromotion.id}` : '/api/promotions';
      const method = editingPromotion ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save promotion');
      }

      setShowDialog(false);
      router.refresh();

      // Refresh local list
      const listRes = await fetch('/api/promotions');
      if (listRes.ok) {
        setPromotions(await listRes.json());
      }
    } catch (err: any) {
      setFormError(err.message || 'Error saving promotion');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeletePromotion() {
    if (!deletingPromotion) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/promotions/${deletingPromotion.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete promotion');
      }

      setDeletingPromotion(null);
      setPromotions((prev) => prev.filter((p) => p.id !== deletingPromotion.id));
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Error deleting promotion');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleStatus(promo: Promotion, newStatus: PromotionStatus) {
    try {
      const res = await fetch(`/api/promotions/${promo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      setPromotions((prev) => prev.map((p) => (p.id === promo.id ? { ...p, status: newStatus } : p)));
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Error updating status');
    }
  }

  // Available promo codes for picker
  const availablePromoCodes = useMemo(() => {
    return allPromoCodes.filter((pc) => {
      // available if not linked, or linked to this current editing promotion
      if (!pc.promotionLink) return true;
      return editingPromotion && pc.promotionLink.promotionId === editingPromotion.id;
    });
  }, [allPromoCodes, editingPromotion]);

  return (
    <div className="space-y-4">
      {/* Top filters and actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search promotions or promo codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="AUTOMATIC">Automatic</SelectItem>
              <SelectItem value="PROMO_CODE">Promo Code</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={openCreateDialog} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" />
          Create Promotion
        </Button>
      </div>

      {/* Promotions Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Promotion</TableHead>
              <TableHead>Mode & Codes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Benefit</TableHead>
              <TableHead className="text-center">Priority / Ver.</TableHead>
              <TableHead>Usage / Limits</TableHead>
              <TableHead className="hidden lg:table-cell">Validity</TableHead>
              <TableHead className="w-[60px] text-right"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPromotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No promotions found. Click &quot;Create Promotion&quot; to add one.
                </TableCell>
              </TableRow>
            ) : (
              filteredPromotions.map((promo) => (
                <TableRow key={promo.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="font-semibold text-foreground">{promo.name}</div>
                    {promo.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {promo.description}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      {promo.activationMode === 'AUTOMATIC' ? (
                        <Badge variant="secondary" className="gap-1 font-normal bg-purple-50 text-purple-700 border-purple-200">
                          <Sparkles className="h-3 w-3 text-purple-600" />
                          Automatic
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 font-normal bg-blue-50 text-blue-700 border-blue-200">
                          <Tag className="h-3 w-3 text-blue-600" />
                          Promo Code
                        </Badge>
                      )}

                      {promo.promoCodeLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {promo.promoCodeLinks.map((link) => (
                            <Badge key={link.promoCode.id} variant="outline" className="font-mono text-[10px] px-1 py-0">
                              {link.promoCode.code}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className={`font-medium ${STATUS_BADGE_CLASSES[promo.status]}`}>
                      {promo.status}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm font-medium">
                      {formatBenefitSummary(promo.benefits, promo.currency)}
                    </div>
                    {promo.combinationPolicy?.combinable && (
                      <div className="text-[11px] text-muted-foreground">Combinable with others</div>
                    )}
                  </TableCell>

                  <TableCell className="text-center font-mono text-xs">
                    <div>Prio: {promo.priority}</div>
                    <div className="text-muted-foreground">v{promo.version}</div>
                  </TableCell>

                  <TableCell className="text-xs">
                    <div>Uses: {promo.usageCount}{promo.usageLimit != null ? ` / ${promo.usageLimit}` : ''}</div>
                    <div className="text-muted-foreground">
                      Applied: {promo._count?.applications ?? 0} order(s)
                    </div>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    <div>From: {promo.startsAt ? new Date(promo.startsAt).toLocaleDateString() : 'Immediate'}</div>
                    <div>To: {promo.endsAt ? new Date(promo.endsAt).toLocaleDateString() : 'No expiry'}</div>
                  </TableCell>

                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(promo)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => openDuplicateDialog(promo)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {promo.status === 'ACTIVE' ? (
                          <DropdownMenuItem onClick={() => handleToggleStatus(promo, 'PAUSED')}>
                            <Pause className="mr-2 h-4 w-4 text-amber-600" />
                            Pause
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleToggleStatus(promo, 'ACTIVE')}>
                            <Play className="mr-2 h-4 w-4 text-emerald-600" />
                            Activate
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => setDeletingPromotion(promo)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
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

      {/* Create / Edit Promotion Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPromotion ? `Edit Promotion: ${editingPromotion.name}` : 'New Promotion'}
            </DialogTitle>
            <DialogDescription>
              Define promotional discounts, automatic cart rules, or promo code benefits.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-6 py-2">
            {/* Top row: Name, Activation Mode, Status */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="promo-name">Promotion Name *</Label>
                <Input
                  id="promo-name"
                  placeholder="e.g. 50% off second game"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="promo-desc">Description (Optional)</Label>
                <Textarea
                  id="promo-desc"
                  placeholder="Customer or admin notes about this promotion"
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo-mode">Activation Mode</Label>
                <Select
                  value={formActivationMode}
                  onValueChange={(val) => setFormActivationMode(val as PromotionActivationMode)}
                >
                  <SelectTrigger id="promo-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTOMATIC">Automatic (Cart rules)</SelectItem>
                    <SelectItem value="PROMO_CODE">Promo Code (Activated by code)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="promo-status">Status</Label>
                <Select
                  value={formStatus}
                  onValueChange={(val) => setFormStatus(val as PromotionStatus)}
                >
                  <SelectTrigger id="promo-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* If PROMO_CODE, select linked promo codes */}
            {formActivationMode === 'PROMO_CODE' && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">Linked Promo Codes</Label>
                    <p className="text-xs text-muted-foreground">
                      Customers enter one of these codes at checkout to activate this promotion.
                    </p>
                  </div>
                </div>

                {/* Selected codes badges */}
                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-background border rounded-md">
                  {selectedPromoCodeIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No promo codes linked yet</span>
                  ) : (
                    selectedPromoCodeIds.map((codeId) => {
                      const found = allPromoCodes.find((c) => c.id === codeId);
                      return (
                        <Badge key={codeId} variant="secondary" className="gap-1 font-mono text-xs">
                          {found?.code || codeId}
                          <button
                            type="button"
                            onClick={() => setSelectedPromoCodeIds((ids) => ids.filter((id) => id !== codeId))}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })
                  )}
                </div>

                {/* Add code selector */}
                <div className="flex items-center gap-2">
                  <Select
                    onValueChange={(val) => {
                      if (val && !selectedPromoCodeIds.includes(val)) {
                        setSelectedPromoCodeIds((prev) => [...prev, val]);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-[300px]">
                      <SelectValue placeholder="Add promo code..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePromoCodes
                        .filter((c) => !selectedPromoCodeIds.includes(c.id))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="font-mono font-medium">{c.code}</span> ({c.name})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Rules Section: Visual Builder vs Raw JSON */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-semibold">Rules Configuration</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure benefits, eligibility conditions, and application limits.
                  </p>
                </div>

                <Tabs
                  value={ruleTab}
                  onValueChange={(val) => {
                    if (val === 'json') syncVisualToJson();
                    setRuleTab(val as 'visual' | 'json');
                  }}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="visual" className="text-xs">Visual Builder</TabsTrigger>
                    <TabsTrigger value="json" className="text-xs">Raw JSON</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {ruleTab === 'visual' ? (
                <div className="space-y-5 pt-1">
                  {/* Benefit Builder */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                      1. Benefit (Discount / Reward)
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Benefit Type</Label>
                        <Select
                          value={benefitType}
                          onValueChange={(val) => setBenefitType(val as any)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage Discount (%)</SelectItem>
                            <SelectItem value="fixed_amount">Fixed Amount Discount</SelectItem>
                            <SelectItem value="free_shipping">Free Shipping</SelectItem>
                            <SelectItem value="custom">Custom (defined in JSON)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {benefitType === 'percentage' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Percentage Off (%)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            placeholder="e.g. 50"
                            value={benefitPercentage}
                            onChange={(e) => setBenefitPercentage(e.target.value)}
                          />
                        </div>
                      )}

                      {benefitType === 'fixed_amount' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Amount ({formCurrency})</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="e.g. 5000"
                            value={benefitAmount}
                            onChange={(e) => setBenefitAmount(e.target.value)}
                          />
                        </div>
                      )}

                      {benefitType !== 'free_shipping' && benefitType !== 'custom' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Applies To</Label>
                          <Select value={benefitAppliesTo} onValueChange={setBenefitAppliesTo}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="order">Entire Order (Subtotal)</SelectItem>
                              <SelectItem value="second_eligible_item">Second Eligible Item</SelectItem>
                              <SelectItem value="all_eligible_items">All Eligible Items</SelectItem>
                              <SelectItem value="cheapest_item">Cheapest Item in Cart</SelectItem>
                              <SelectItem value="order_item">Single Item</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {benefitType === 'percentage' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Max Discount Cap ({formCurrency})</Label>
                          <Input
                            type="number"
                            placeholder="Optional cap (e.g. 15000)"
                            value={benefitMaxDiscount}
                            onChange={(e) => setBenefitMaxDiscount(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conditions Builder */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                      2. Eligibility Conditions
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Min Quantity of Items</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g. 2"
                          value={condMinQuantity}
                          onChange={(e) => setCondMinQuantity(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Min Subtotal ({formCurrency})</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g. 30000"
                          value={condMinSubtotal}
                          onChange={(e) => setCondMinSubtotal(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Product Tags (comma-separated)</Label>
                        <Input
                          placeholder="e.g. games, accessories"
                          value={condProductTags}
                          onChange={(e) => setCondProductTags(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Application & Combination Policy */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="text-xs font-semibold text-primary uppercase tracking-wider">
                      3. Application & Combination Policy
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Max Applications Per Order</Label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="e.g. 1"
                          value={policyMaxPerOrder}
                          onChange={(e) => setPolicyMaxPerOrder(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <Checkbox
                          id="policy-combinable"
                          checked={policyCombinable}
                          onCheckedChange={(checked) => setPolicyCombinable(checked === true)}
                        />
                        <Label htmlFor="policy-combinable" className="text-xs font-normal cursor-pointer">
                          Combinable with other active promotions in the same order
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Raw JSON editor mode */
                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono">conditions (JSON)</Label>
                    <Textarea
                      rows={3}
                      className="font-mono text-xs"
                      value={jsonConditions}
                      onChange={(e) => setJsonConditions(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono">benefits (JSON)</Label>
                    <Textarea
                      rows={3}
                      className="font-mono text-xs"
                      value={jsonBenefits}
                      onChange={(e) => setJsonBenefits(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono">applicationPolicy (JSON)</Label>
                    <Textarea
                      rows={2}
                      className="font-mono text-xs"
                      value={jsonApplicationPolicy}
                      onChange={(e) => setJsonApplicationPolicy(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono">combinationPolicy (JSON)</Label>
                    <Textarea
                      rows={2}
                      className="font-mono text-xs"
                      value={jsonCombinationPolicy}
                      onChange={(e) => setJsonCombinationPolicy(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono">metadata (JSON, optional)</Label>
                    <Textarea
                      rows={2}
                      className="font-mono text-xs"
                      placeholder="{}"
                      value={jsonMetadata}
                      onChange={(e) => setJsonMetadata(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Row: Priority, Limits, Dates */}
            <div className="grid gap-4 sm:grid-cols-4 border-t pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="promo-prio" className="text-xs">Priority</Label>
                <Input
                  id="promo-prio"
                  type="number"
                  placeholder="0"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">Higher evaluated first</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promo-currency" className="text-xs">Currency</Label>
                <Input
                  id="promo-currency"
                  placeholder="CLP"
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promo-usage-limit" className="text-xs">Total Usage Limit</Label>
                <Input
                  id="promo-usage-limit"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formUsageLimit}
                  onChange={(e) => setFormUsageLimit(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promo-per-customer" className="text-xs">Per-Customer Limit</Label>
                <Input
                  id="promo-per-customer"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formPerCustomerLimit}
                  onChange={(e) => setFormPerCustomerLimit(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="promo-starts-at" className="text-xs">Starts At (Optional)</Label>
                <Input
                  id="promo-starts-at"
                  type="datetime-local"
                  value={formStartsAt}
                  onChange={(e) => setFormStartsAt(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="promo-ends-at" className="text-xs">Ends At (Optional)</Label>
                <Input
                  id="promo-ends-at"
                  type="datetime-local"
                  value={formEndsAt}
                  onChange={(e) => setFormEndsAt(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSavePromotion} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPromotion ? 'Save Changes' : 'Create Promotion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingPromotion} onOpenChange={(open) => !open && setDeletingPromotion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Promotion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingPromotion?.name}&quot;?
              Historical order records will retain their snapshots, but this promotion rule will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPromotion(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePromotion} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
