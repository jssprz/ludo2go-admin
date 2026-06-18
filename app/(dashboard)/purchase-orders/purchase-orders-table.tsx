'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Eye,
  X,
} from 'lucide-react';

type SupplierOption = {
  id: string;
  name: string;
  code: string;
};

type VariantOption = {
  id: string;
  sku: string;
  product: {
    id: string;
    name: string;
    mediaLinks: Array<{
      media: {
        id: string;
        url: string;
        thumbUrl: string | null;
        alt: string | null;
      };
    }>;
  };
};

type OrderItem = {
  id: string;
  variantId: string;
  quantity: number;
  quantityReceived: number;
  unitCost: number;
  discount: number;
  total: number;
  variant: {
    id: string;
    sku: string;
    product: { name: string };
  };
};

type PurchaseOrder = {
  id: string;
  code: string;
  supplierId: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  pdfFileUrl: string | null;
  notes: string | null;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: SupplierOption;
  items: OrderItem[];
};

type Props = {
  initialOrders: PurchaseOrder[];
  suppliers: SupplierOption[];
  variants: VariantOption[];
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'partially_received', label: 'Partially Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  partially_received: 'bg-amber-100 text-amber-800',
  received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(currency === 'CLP' ? 'es-CL' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'CLP' ? 0 : 2,
  }).format(amount);
}

function getItemTotal(quantity: number, unitCost: number, discount: number) {
  return Math.max(0, quantity * unitCost - discount);
}

function getItemsSubtotal(items: Array<{ quantity: number; unitCost: number; discount: number }>) {
  return items.reduce((sum, item) => sum + getItemTotal(item.quantity, item.unitCost, item.discount), 0);
}

function getTotalQuantity(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function getTotalReceived(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + item.quantityReceived, 0);
}

function getTax(subtotal: number, shipping: number, includeShippingInTax: boolean) {
  const taxBase = subtotal + (includeShippingInTax ? shipping : 0);
  return Math.round(taxBase * 0.19);
}

function inferIncludeShippingInTax(order: PurchaseOrder) {
  const withShipping = Math.round((order.subtotal + order.shipping) * 0.19);
  const withoutShipping = Math.round(order.subtotal * 0.19);
  return Math.abs(order.tax - withShipping) <= Math.abs(order.tax - withoutShipping);
}

export function PurchaseOrdersTable({ initialOrders, suppliers, variants }: Props) {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>(initialOrders);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formCurrency, setFormCurrency] = useState('CLP');
  const [formShipping, setFormShipping] = useState(0);
  const [formIncludeShippingInTax, setFormIncludeShippingInTax] = useState(false);
  const [formPdfFileUrl, setFormPdfFileUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formOrderedAt, setFormOrderedAt] = useState('');
  const [formExpectedAt, setFormExpectedAt] = useState('');
  const [formItems, setFormItems] = useState<Array<{ variantId: string; quantity: number; unitCost: number; discount: number }>>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploadingCreatePdf, setIsUploadingCreatePdf] = useState(false);

  // Detail/edit dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPdfFileUrl, setEditPdfFileUrl] = useState('');
  const [editItems, setEditItems] = useState<Array<{ variantId: string; quantity: number; quantityReceived: number; unitCost: number; discount: number }>>([]);
  const [editShipping, setEditShipping] = useState<number>(0);
  const [editIncludeShippingInTax, setEditIncludeShippingInTax] = useState(false);
  const [isUploadingEditPdf, setIsUploadingEditPdf] = useState(false);

  function resetCreateForm() {
    setFormCode('');
    setFormSupplierId('');
    setFormCurrency('CLP');
    setFormShipping(0);
    setFormIncludeShippingInTax(false);
    setFormPdfFileUrl('');
    setFormNotes('');
    setFormOrderedAt('');
    setFormExpectedAt('');
    setFormItems([]);
    setFormError(null);
  }

  async function uploadPdfFile(file: File, mode: 'create' | 'edit') {
    if (file.type !== 'application/pdf') {
      throw new Error('Only PDF files are allowed');
    }

    if (mode === 'create') setIsUploadingCreatePdf(true);
    if (mode === 'edit') setIsUploadingEditPdf(true);

    try {
      const timestamp = Date.now();
      const blob = await upload(`purchase-orders/pdf/${timestamp}-${file.name}`, file, {
        access: 'public',
        handleUploadUrl: '/api/media/upload',
        clientPayload: JSON.stringify({
          sizeBytes: file.size,
          mime: file.type,
        }),
      });

      if (mode === 'create') setFormPdfFileUrl(blob.url);
      if (mode === 'edit') setEditPdfFileUrl(blob.url);
    } finally {
      if (mode === 'create') setIsUploadingCreatePdf(false);
      if (mode === 'edit') setIsUploadingEditPdf(false);
    }
  }

  async function handlePdfInputChange(
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'create' | 'edit'
  ) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      await uploadPdfFile(files[0], mode);
    } catch (error: any) {
      alert(error?.message || 'Failed to upload PDF');
    } finally {
      e.target.value = '';
    }
  }

  function addItem() {
    setFormItems([...formItems, { variantId: '', quantity: 1, unitCost: 0, discount: 0 }]);
  }

  function removeItem(index: number) {
    setFormItems(formItems.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: string, value: any) {
    const updated = [...formItems];
    (updated[index] as any)[field] = value;
    setFormItems(updated);
  }

  function addEditItem() {
    setEditItems([
      ...editItems,
      { variantId: '', quantity: 1, quantityReceived: 0, unitCost: 0, discount: 0 },
    ]);
  }

  function removeEditItem(index: number) {
    setEditItems(editItems.filter((_, i) => i !== index));
  }

  function updateEditItem(index: number, field: string, value: any) {
    const updated = [...editItems];
    const next = { ...updated[index], [field]: value } as any;
    if (field === 'quantity' && next.quantityReceived > value) {
      next.quantityReceived = value;
    }
    updated[index] = next;
    setEditItems(updated);
  }

  const formSubtotal = getItemsSubtotal(formItems);
  const normalizedFormShipping = Math.max(0, formShipping || 0);
  const formTax = getTax(formSubtotal, normalizedFormShipping, formIncludeShippingInTax);
  const formTotal = formSubtotal + normalizedFormShipping + formTax;

  const editSubtotal = getItemsSubtotal(editItems);
  const normalizedEditShipping = Math.max(0, editShipping || 0);
  const editTax = getTax(editSubtotal, normalizedEditShipping, editIncludeShippingInTax);
  const editTotal = editSubtotal + normalizedEditShipping + editTax;

  async function handleCreate() {
    if (!formCode.trim() || !formSupplierId) {
      setFormError('Code and supplier are required');
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formCode.trim(),
          supplierId: formSupplierId,
          currency: formCurrency,
          shipping: normalizedFormShipping,
          includeShippingInTax: formIncludeShippingInTax,
          pdfFileUrl: formPdfFileUrl.trim() || null,
          notes: formNotes.trim() || null,
          orderedAt: formOrderedAt || null,
          expectedAt: formExpectedAt || null,
          items: formItems.filter((i) => i.variantId),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to create purchase order');
      }

      setShowCreateDialog(false);
      resetCreateForm();
      router.refresh();
      const listRes = await fetch('/api/purchase-orders');
      if (listRes.ok) setOrders(await listRes.json());
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function openDetail(order: PurchaseOrder) {
    setSelectedOrder(order);
    setEditStatus(order.status);
    setEditNotes(order.notes ?? '');
    setEditPdfFileUrl(order.pdfFileUrl ?? '');
    setEditShipping(order.shipping);
    setEditIncludeShippingInTax(inferIncludeShippingInTax(order));
    setEditItems(
      order.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        quantityReceived: item.quantityReceived,
        unitCost: item.unitCost,
        discount: item.discount || 0,
      }))
    );
    setShowDetailDialog(true);
  }

  async function handleUpdateStatus() {
    if (!selectedOrder) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          notes: editNotes.trim() || null,
          pdfFileUrl: editPdfFileUrl.trim() || null,
          shipping: normalizedEditShipping,
          includeShippingInTax: editIncludeShippingInTax,
          items: editItems.filter((i) => i.variantId),
          ...(editStatus === 'received' ? { receivedAt: new Date().toISOString() } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to update');
      }

      setShowDetailDialog(false);
      router.refresh();
      const listRes = await fetch('/api/purchase-orders');
      if (listRes.ok) setOrders(await listRes.json());
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(order: PurchaseOrder) {
    if (!confirm(`Delete PO "${order.code}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/purchase-orders/${order.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete');
      }
      setOrders(orders.filter((o) => o.id !== order.id));
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const filtered = orders.filter(
    (o) =>
      o.code.toLowerCase().includes(search.toLowerCase()) ||
      o.supplier.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Purchase Orders</CardTitle>
            <CardDescription>{orders.length} order(s) total</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Button onClick={() => { resetCreateForm(); setShowCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              New PO
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Items</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell">Ordered</TableHead>
              <TableHead className="hidden md:table-cell">Expected</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  No purchase orders found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(order)}
                >
                  <TableCell className="font-mono text-xs">{order.code}</TableCell>
                  <TableCell className="font-medium">{order.supplier.name}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[order.status] ?? ''} variant="secondary">
                      {STATUS_OPTIONS.find((s) => s.value === order.status)?.label ?? order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{order.items.length}</TableCell>
                  <TableCell className="text-right">{getTotalQuantity(order.items)}</TableCell>
                  <TableCell className="text-right">{getTotalReceived(order.items)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(order.total, order.currency)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {order.orderedAt ? new Date(order.orderedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {order.expectedAt ? new Date(order.expectedAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetail(order)}>
                          <Eye className="h-4 w-4 mr-2" /> View / Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(order)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>Create a purchase order for a supplier.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>PO Code *</Label>
                <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="PO-2026-001" />
              </div>
              <div className="space-y-2">
                <Label>Supplier *</Label>
                <Select value={formSupplierId} onValueChange={setFormSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLP">CLP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Order date</Label>
                <Input type="date" value={formOrderedAt} onChange={(e) => setFormOrderedAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Expected delivery</Label>
                <Input type="date" value={formExpectedAt} onChange={(e) => setFormExpectedAt(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} placeholder="Notes..." />
            </div>

            <div className="space-y-2">
              <Label>Attachment PDF (optional)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="po-create-pdf-upload">
                  <Button asChild variant="outline" size="sm" disabled={isUploadingCreatePdf}>
                    <span>{isUploadingCreatePdf ? 'Uploading PDF...' : 'Upload PDF'}</span>
                  </Button>
                </label>
                <Input
                  id="po-create-pdf-upload"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => handlePdfInputChange(e, 'create')}
                  disabled={isUploadingCreatePdf}
                />
                {formPdfFileUrl && (
                  <>
                    <Button variant="outline" size="sm" asChild>
                      <a href={formPdfFileUrl} target="_blank" rel="noopener noreferrer">Open PDF</a>
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setFormPdfFileUrl('')}>
                      Remove
                    </Button>
                  </>
                )}
              </div>
              <Input
                placeholder="https://.../invoice.pdf"
                value={formPdfFileUrl}
                onChange={(e) => setFormPdfFileUrl(e.target.value)}
              />
            </div>

            {/* Line items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add item
                </Button>
              </div>

              {formItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
                  No items yet. Click &quot;Add item&quot; to start.
                </p>
              )}

              {formItems.map((item, idx) => (
                <div key={idx} className="flex items-end gap-2 border rounded-md p-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Variant</Label>
                    <Select value={item.variantId} onValueChange={(val) => updateItem(idx, 'variantId', val)}>
                      <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                      <SelectContent>
                        {variants.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.product.name} - {v.sku}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Unit cost</Label>
                    <Input
                      type="number"
                      step="1"
                      value={item.unitCost}
                      onChange={(e) => updateItem(idx, 'unitCost', Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Discount</Label>
                    <Input
                      type="number"
                      step="1"
                      min={0}
                      value={item.discount}
                      onChange={(e) => updateItem(idx, 'discount', Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                  <div className="w-24 text-right text-sm font-medium pt-5">
                    {formatCurrency(getItemTotal(item.quantity, item.unitCost, item.discount), formCurrency)}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removeItem(idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Shipping</Label>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={formShipping}
                    onChange={(e) => setFormShipping(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="form-include-shipping-tax"
                      checked={formIncludeShippingInTax}
                      onCheckedChange={(v) => setFormIncludeShippingInTax(!!v)}
                    />
                    <Label htmlFor="form-include-shipping-tax">Include shipping before 19% tax</Label>
                  </div>
                </div>
              </div>

              <div className="border rounded-md p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(formSubtotal, formCurrency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (19%)</span>
                  <span>{formatCurrency(formTax, formCurrency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{formatCurrency(normalizedFormShipping, formCurrency)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Total</span>
                  <span>{formatCurrency(formTotal, formCurrency)}</span>
                </div>
              </div>
            </div>

            {formError && <p className="text-sm text-red-500">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isLoading}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating…</> : 'Create PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / Edit Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle>PO: {selectedOrder.code}</DialogTitle>
                <DialogDescription>
                  Supplier: {selectedOrder.supplier.name} ({selectedOrder.supplier.code})
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Shipping</Label>
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      value={editShipping}
                      onChange={(e) => setEditShipping(Math.max(0, Number(e.target.value) || 0))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax (19%)</Label>
                    <Input value={formatCurrency(editTax, selectedOrder.currency)} disabled />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-include-shipping-tax"
                    checked={editIncludeShippingInTax}
                    onCheckedChange={(v) => setEditIncludeShippingInTax(!!v)}
                  />
                  <Label htmlFor="edit-include-shipping-tax">Include shipping before 19% tax</Label>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
                </div>

                <div className="space-y-2">
                  <Label>Attachment PDF (optional)</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="po-edit-pdf-upload">
                      <Button asChild variant="outline" size="sm" disabled={isUploadingEditPdf}>
                        <span>{isUploadingEditPdf ? 'Uploading PDF...' : 'Upload PDF'}</span>
                      </Button>
                    </label>
                    <Input
                      id="po-edit-pdf-upload"
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => handlePdfInputChange(e, 'edit')}
                      disabled={isUploadingEditPdf}
                    />
                    {editPdfFileUrl && (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <a href={editPdfFileUrl} target="_blank" rel="noopener noreferrer">Open PDF</a>
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditPdfFileUrl('')}>
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                  <Input
                    placeholder="https://.../invoice.pdf"
                    value={editPdfFileUrl}
                    onChange={(e) => setEditPdfFileUrl(e.target.value)}
                  />
                </div>

                {/* Order items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Items ({editItems.length})</Label>
                  </div>

                  {editItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-md border-dashed">
                      No items yet. Click &quot;Add item&quot; to start.
                    </p>
                  )}

                  {editItems.map((item, idx) => {
                    const variantData = variants.find((v) => v.id === item.variantId);
                    const productImage = variantData?.product.mediaLinks[0]?.media;

                    return (
                      <div key={idx} className="grid gap-3 border rounded-md p-3">
                        <div className="grid gap-3 md:grid-cols-[80px,minmax(0,1fr),90px,120px,120px,120px,80px]">
                          {/* Product Image */}
                          {productImage && (
                            <div className="hidden md:flex items-center justify-center border rounded bg-muted overflow-hidden">
                              <img
                                src={productImage.thumbUrl || productImage.url}
                                alt={productImage.alt || 'Product'}
                                className="h-16 w-16 object-cover"
                              />
                            </div>
                          )}

                          <div className="space-y-1">
                            <Label className="text-xs">Variant</Label>
                            <Select value={item.variantId} onValueChange={(val) => updateEditItem(idx, 'variantId', val)}>
                              <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                              <SelectContent>
                                {variants.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.product.name} - {v.sku}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateEditItem(idx, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Received</Label>
                            <Input
                              type="number"
                              min={0}
                              max={item.quantity}
                              value={item.quantityReceived}
                              onChange={(e) => {
                                const next = Math.max(0, Number(e.target.value) || 0);
                                updateEditItem(idx, 'quantityReceived', Math.min(next, item.quantity));
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unit cost</Label>
                            <Input
                              type="number"
                              min={0}
                              step="1"
                              value={item.unitCost}
                              onChange={(e) => updateEditItem(idx, 'unitCost', Math.max(0, Number(e.target.value) || 0))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Discount</Label>
                            <Input
                              type="number"
                              min={0}
                              step="1"
                              value={item.discount}
                              onChange={(e) => updateEditItem(idx, 'discount', Math.max(0, Number(e.target.value) || 0))}
                            />
                          </div>
                          <div className="flex items-end justify-end pb-1">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeEditItem(idx)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-right text-sm font-medium">
                          {formatCurrency(getItemTotal(item.quantity, item.unitCost, item.discount), selectedOrder.currency)}
                        </div>
                      </div>
                    );
                  })}

                  <div className="border rounded-md p-3 bg-muted/30">
                    <Button type="button" variant="outline" className="w-full" onClick={addEditItem}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add item
                    </Button>
                  </div>

                  {/* Item Totals */}
                  {editItems.length > 0 && (
                    <div className="border rounded-md p-3 space-y-1 text-sm bg-muted/30">
                      <div className="flex justify-between">
                        <span>Total Qty:</span>
                        <span className="font-semibold">{editItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Received:</span>
                        <span className="font-semibold">{editItems.reduce((sum, item) => sum + item.quantityReceived, 0)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="border rounded-md p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(editSubtotal, selectedOrder.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax (19%)</span>
                    <span>{formatCurrency(editTax, selectedOrder.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{formatCurrency(normalizedEditShipping, selectedOrder.currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total</span>
                    <span>{formatCurrency(editTotal, selectedOrder.currency)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailDialog(false)} disabled={isLoading}>Close</Button>
                <Button onClick={handleUpdateStatus} disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> : 'Save changes'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
