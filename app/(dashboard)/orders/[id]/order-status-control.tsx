'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { canEditOrderTracking } from '@/lib/order-update';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'cancelled',
];

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  ready_to_ship: 'bg-cyan-100 text-cyan-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function OrderStatusControl({ orderId, status, courierTrackingNumber = null }: { orderId: string; status: OrderStatus; courierTrackingNumber?: string | null }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [tracking, setTracking] = useState(courierTrackingNumber ?? '');
  const [savedTracking, setSavedTracking] = useState(courierTrackingNumber ?? '');
  const [message, setMessage] = useState('');
  const savingRef = useRef(false);

  useEffect(() => { setCurrentStatus(status); }, [status]);
  useEffect(() => {
    setTracking(courierTrackingNumber ?? '');
    setSavedTracking(courierTrackingNumber ?? '');
  }, [courierTrackingNumber]);

  async function saveUpdate(payload: { status?: OrderStatus; courierTrackingNumber?: string | null }) {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    setMessage('');

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message ?? 'Could not update order status.');
      setCurrentStatus(result?.status ?? payload.status ?? currentStatus);
      if (payload.courierTrackingNumber !== undefined) {
        const saved = result?.courierTrackingNumber ?? '';
        setTracking(saved);
        setSavedTracking(saved);
      }
      setMessage(payload.courierTrackingNumber === undefined ? 'Status saved.' : 'Tracking number saved.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update order status.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <Select value={currentStatus} onValueChange={(value) => { if (value !== currentStatus) void saveUpdate({ status: value as OrderStatus }); }} disabled={isSaving}>
        <SelectTrigger aria-label="Change order status" className="w-full max-w-xs">
          <SelectValue>
            <Badge className={STATUS_COLORS[currentStatus]}>{currentStatus}</Badge>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ORDER_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canEditOrderTracking(currentStatus) ? (
        <form className="max-w-md space-y-2" onSubmit={(event) => {
          event.preventDefault();
          void saveUpdate({ courierTrackingNumber: tracking.trim() || null });
        }}>
          <Label htmlFor={`tracking-${orderId}`}>Courier tracking number</Label>
          <div className="flex flex-wrap gap-2">
            <Input id={`tracking-${orderId}`} className="min-w-0 flex-1" value={tracking} disabled={isSaving}
              onChange={(event) => { setTracking(event.target.value); setMessage(''); }} />
            <Button type="submit" disabled={isSaving || tracking.trim() === savedTracking}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save tracking
            </Button>
          </div>
        </form>
      ) : courierTrackingNumber ? <p className="text-sm">Courier tracking number: {courierTrackingNumber}</p> : null}
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{isSaving ? 'Saving order...' : message}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}