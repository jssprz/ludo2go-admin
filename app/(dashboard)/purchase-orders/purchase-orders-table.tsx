'use client';

import { useState } from 'react';
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
  product: { name: string };
};

type OrderItem = {
  id: string;
  variantId: string;
  quantity: number;
  quantityReceived: number;
  unitCost: number;
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
  const [formNotes, setFormNotes] = useState('');
  const [formOrderedAt, setFormOrderedAt] = useState('');
  const [formExpectedAt, setFormExpectedAt] = useState('');
  const [formItems, setFormItems] = useState<Array<{ variantId: string; quantity: number; unitCost: number }>>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Detail/edit dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editTax, setEditTax] = useState<number>(0);
  const [editShipping, setEditShipping] = useState<number>(0);

  function resetCreateForm() {
    setFormCode('');
    setFormSupplierId('');
    setFormCurrency('CLP');
    setFormNotes('');
    setFormOrderedAt('');
    setFormExpectedAt('');
    setFormItems([]);
    setFormError(null);
  }

  function addItem() {
    setFormItems([...formItems, { variantId: '', quantity: 1, unitCost: 0 }]);
  }

  function removeItem(index: number) {
    setFormItems(formItems.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: string, value: any) {
    const updated = [...formItems];
    (updated[index] as any)[field] = value;
    setFormItems(updated);
  }

  function getItemsSubtotal() {
    return formItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  }

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
    setEditTax(order.tax);
    setEditShipping(order.shipping);
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
          tax: editTax,
          shipping: editShipping,
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
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell">Ordered</TableHead>
              <TableHead className="hidden md:table-cell">Expected</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                            {v.sku} — {v.product.name}
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
                      step="0.01"
                      value={item.unitCost}
                      onChange={(e) => updateItem(idx, 'unitCost', Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-24 text-right text-sm font-medium pt-5">
                    {formatCurrency(item.quantity * item.unitCost, formCurrency)}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => removeItem(idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {formItems.length > 0 && (
                <div className="text-right text-sm font-medium">
                  Subtotal: {formatCurrency(getItemsSubtotal(), formCurrency)}
                </div>
              )}
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
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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
                    <Label>Tax</Label>
                    <Input type="number" step="0.01" value={editTax} onChange={(e) => setEditTax(Number(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Shipping</Label>
                    <Input type="number" step="0.01" value={editShipping} onChange={(e) => setEditShipping(Number(e.target.value) || 0)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
                </div>

                {/* Order items */}
                <div className="space-y-2">
                  <Label className="text-base font-medium">Items ({selectedOrder.items.length})</Label>
                  <div className="border rounded-md divide-y">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{item.variant.sku}</span>
                          <span className="text-muted-foreground ml-2">{item.variant.product.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <span>{item.quantityReceived}/{item.quantity} received</span>
                          <span className="font-medium">
                            {formatCurrency(item.unitCost, selectedOrder.currency)} × {item.quantity}
                          </span>
                          <span className="font-bold min-w-[80px]">
                            {formatCurrency(item.total, selectedOrder.currency)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="border rounded-md p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal, selectedOrder.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatCurrency(editTax, selectedOrder.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span>{formatCurrency(editShipping, selectedOrder.currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.subtotal + editTax + editShipping, selectedOrder.currency)}</span>
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
