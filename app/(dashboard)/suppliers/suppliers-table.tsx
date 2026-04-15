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
  Check,
  XCircle,
} from 'lucide-react';

type Supplier = {
  id: string;
  code: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  region: string | null;
  notes: string | null;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    costPrices: number;
    purchaseOrders: number;
  };
};

type Props = {
  initialSuppliers: Supplier[];
};

export function SuppliersTable({ initialSuppliers }: Props) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('');
  const [formLeadTimeDays, setFormLeadTimeDays] = useState<number | ''>('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  function resetForm() {
    setFormCode('');
    setFormName('');
    setFormContactName('');
    setFormEmail('');
    setFormPhone('');
    setFormWebsite('');
    setFormCountry('');
    setFormRegion('');
    setFormNotes('');
    setFormPaymentTerms('');
    setFormLeadTimeDays('');
    setFormIsActive(true);
    setFormError(null);
  }

  function openEdit(supplier: Supplier) {
    setEditingSupplier(supplier);
    setFormCode(supplier.code);
    setFormName(supplier.name);
    setFormContactName(supplier.contactName ?? '');
    setFormEmail(supplier.email ?? '');
    setFormPhone(supplier.phone ?? '');
    setFormWebsite(supplier.website ?? '');
    setFormCountry(supplier.country ?? '');
    setFormRegion(supplier.region ?? '');
    setFormNotes(supplier.notes ?? '');
    setFormPaymentTerms(supplier.paymentTerms ?? '');
    setFormLeadTimeDays(supplier.leadTimeDays ?? '');
    setFormIsActive(supplier.isActive);
    setFormError(null);
    setShowEditDialog(true);
  }

  async function handleCreate() {
    if (!formCode.trim() || !formName.trim()) {
      setFormError('Code and name are required');
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formCode.trim(),
          name: formName.trim(),
          contactName: formContactName.trim() || null,
          email: formEmail.trim() || null,
          phone: formPhone.trim() || null,
          website: formWebsite.trim() || null,
          country: formCountry.trim() || null,
          region: formRegion.trim() || null,
          notes: formNotes.trim() || null,
          paymentTerms: formPaymentTerms.trim() || null,
          leadTimeDays: formLeadTimeDays !== '' ? Number(formLeadTimeDays) : null,
          isActive: formIsActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to create supplier');
      }

      setShowCreateDialog(false);
      resetForm();
      router.refresh();
      // Refetch
      const listRes = await fetch('/api/suppliers');
      if (listRes.ok) setSuppliers(await listRes.json());
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate() {
    if (!editingSupplier || !formCode.trim() || !formName.trim()) {
      setFormError('Code and name are required');
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/suppliers/${editingSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formCode.trim(),
          name: formName.trim(),
          contactName: formContactName.trim() || null,
          email: formEmail.trim() || null,
          phone: formPhone.trim() || null,
          website: formWebsite.trim() || null,
          country: formCountry.trim() || null,
          region: formRegion.trim() || null,
          notes: formNotes.trim() || null,
          paymentTerms: formPaymentTerms.trim() || null,
          leadTimeDays: formLeadTimeDays !== '' ? Number(formLeadTimeDays) : null,
          isActive: formIsActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to update supplier');
      }

      setShowEditDialog(false);
      resetForm();
      router.refresh();
      const listRes = await fetch('/api/suppliers');
      if (listRes.ok) setSuppliers(await listRes.json());
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(supplier: Supplier) {
    if (!confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete');
      }
      setSuppliers(suppliers.filter((s) => s.id !== supplier.id));
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      (s.contactName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const formFields = (
    <div className="grid gap-4 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Code *</Label>
          <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="e.g. SUP-001" />
        </div>
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Supplier name" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Contact name</Label>
          <Input value={formContactName} onChange={(e) => setFormContactName(e.target.value)} placeholder="Contact person" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@example.com" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+56 9 ..." />
        </div>
        <div className="space-y-2">
          <Label>Website</Label>
          <Input value={formWebsite} onChange={(e) => setFormWebsite(e.target.value)} placeholder="https://..." />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Country</Label>
          <Input value={formCountry} onChange={(e) => setFormCountry(e.target.value)} placeholder="Chile" />
        </div>
        <div className="space-y-2">
          <Label>Region</Label>
          <Input value={formRegion} onChange={(e) => setFormRegion(e.target.value)} placeholder="Región Metropolitana" />
        </div>
        <div className="space-y-2">
          <Label>Lead time (days)</Label>
          <Input
            type="number"
            value={formLeadTimeDays}
            onChange={(e) => setFormLeadTimeDays(e.target.value ? Number(e.target.value) : '')}
            placeholder="15"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Payment terms</Label>
        <Input value={formPaymentTerms} onChange={(e) => setFormPaymentTerms(e.target.value)} placeholder="Net 30, 50% upfront, etc." />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Internal notes about this supplier..." rows={3} />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="supplier-active"
          checked={formIsActive}
          onChange={(e) => setFormIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="supplier-active">Active</Label>
      </div>
      {formError && <p className="text-sm text-red-500">{formError}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Suppliers</CardTitle>
            <CardDescription>{suppliers.length} supplier(s) total</CardDescription>
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
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Add supplier
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="hidden md:table-cell">Country</TableHead>
              <TableHead className="hidden md:table-cell">Lead time</TableHead>
              <TableHead className="hidden md:table-cell">Cost prices</TableHead>
              <TableHead className="hidden md:table-cell">POs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No suppliers found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-mono text-xs">{supplier.code}</TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>
                    <div className="text-sm">{supplier.contactName ?? '—'}</div>
                    {supplier.email && (
                      <div className="text-xs text-muted-foreground">{supplier.email}</div>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{supplier.country ?? '—'}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {supplier.leadTimeDays != null ? `${supplier.leadTimeDays}d` : '—'}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{supplier._count.costPrices}</TableCell>
                  <TableCell className="hidden md:table-cell">{supplier._count.purchaseOrders}</TableCell>
                  <TableCell>
                    {supplier.isActive ? (
                      <Badge variant="secondary" className="gap-1">
                        <Check className="h-3 w-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground">
                        <XCircle className="h-3 w-3" /> Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(supplier)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(supplier)}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New supplier</DialogTitle>
            <DialogDescription>Add a new supplier to the system.</DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isLoading}>
              {isLoading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creating…</> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
            <DialogDescription>Update supplier information.</DialogDescription>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isLoading}>
              {isLoading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
