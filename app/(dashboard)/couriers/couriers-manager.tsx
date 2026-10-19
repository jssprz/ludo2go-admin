'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { courierSchema } from '@/lib/courier';

type Courier = { id: string; name: string; trackingUrlTemplate: string | null };

export function CouriersManager({ couriers, loadError = null }: {
  couriers: Courier[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const submitting = useRef(false);

  function openForm(courier: Courier | null) {
    setEditing(courier);
    setName(courier?.name ?? '');
    setTemplate(courier?.trackingUrlTemplate ?? '');
    setError(null);
    setOpen(true);
  }

  function refresh() {
    startRefresh(() => router.refresh());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    const parsed = courierSchema.safeParse({ name, trackingUrlTemplate: template });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/couriers/${encodeURIComponent(editing.id)}` : '/api/couriers', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data)
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(response.status === 409
          ? 'A courier with this name already exists.'
          : typeof payload?.error === 'string' ? payload.error : 'Failed to save courier.');
        return;
      }
      setOpen(false);
      refresh();
    } catch {
      setError('Failed to save courier. Please try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Couriers</h1>
        <Button onClick={() => openForm(null)} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
          Add courier
        </Button>
      </div>
      {loadError ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : (
        <div className="rounded-md border" aria-busy={refreshing}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tracking URL template</TableHead>
                <TableHead className="w-16"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {couriers.map((courier) => (
                <TableRow key={courier.id}>
                  <TableCell className="min-w-32 break-words font-medium">{courier.name}</TableCell>
                  <TableCell className="max-w-xl break-all font-mono text-xs">{courier.trackingUrlTemplate ?? <span className="font-sans text-muted-foreground">Not set</span>}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" title={`Edit ${courier.name}`} aria-label={`Edit ${courier.name}`} onClick={() => openForm(courier)} disabled={refreshing}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {couriers.length === 0 && <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">No couriers found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (!submitting.current) setOpen(next); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editing ? 'Edit courier' : 'Add courier'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="min-w-0 space-y-4" aria-busy={saving}>
            <div className="space-y-2">
              <Label htmlFor="courier-name">Name</Label>
              <Input id="courier-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courier-template">Tracking URL template</Label>
              <Input id="courier-template" value={template} onChange={(event) => setTemplate(event.target.value)} placeholder="https://courier.example/track/{trackingNumber}" disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? 'courier-error' : undefined} />
            </div>
            {error && <p id="courier-error" role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : editing ? <Save className="mr-2 h-4 w-4" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />}
                {saving ? 'Saving...' : editing ? 'Save courier' : 'Create courier'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}