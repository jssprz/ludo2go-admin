'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ImageUp, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type DeliveryProofSummary = { pathname: string; uploadedAt: string };
export type DeliveryRecipientSummary = { name: string; idNumber: string };

const MAX_DIMENSION = 1600;

async function downscale(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ?? file;
  } catch {
    // Browser can't decode this format (e.g. HEIC on desktop); upload the original.
    return file;
  }
}

export function DeliveryProofCapture({ orderId, proofs, recipient = null }: { orderId: string; proofs: DeliveryProofSummary[]; recipient?: DeliveryRecipientSummary | null }) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [name, setName] = useState(recipient?.name ?? '');
  const [idNumber, setIdNumber] = useState(recipient?.idNumber ?? '');
  const [saved, setSaved] = useState({ name: recipient?.name ?? '', idNumber: recipient?.idNumber ?? '' });
  const [savingRecipient, setSavingRecipient] = useState(false);

  useEffect(() => {
    setName(recipient?.name ?? '');
    setIdNumber(recipient?.idNumber ?? '');
    setSaved({ name: recipient?.name ?? '', idNumber: recipient?.idNumber ?? '' });
  }, [recipient?.name, recipient?.idNumber]);

  async function saveRecipient() {
    setSavingRecipient(true);
    setError(null);
    setMessage('');
    try {
      const response = await fetch(`/api/orders/${orderId}/delivery-proof`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), idNumber: idNumber.trim() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message ?? 'Could not save the recipient.');
      setName(result.name);
      setIdNumber(result.idNumber);
      setSaved({ name: result.name, idNumber: result.idNumber });
      setMessage('Recipient saved.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the recipient.');
    } finally {
      setSavingRecipient(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setMessage('');
    try {
      const body = new FormData();
      const image = await downscale(file);
      body.append('photo', image, image === file ? file.name : 'delivery.jpg');
      const response = await fetch(`/api/orders/${orderId}/delivery-proof`, { method: 'POST', body });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message ?? 'Could not upload the photo.');
      setMessage('Delivery photo saved.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload the photo.');
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveRecipient();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`recipient-name-${orderId}`}>Received by (name)</Label>
            <Input id={`recipient-name-${orderId}`} value={name} maxLength={200} autoComplete="off" disabled={savingRecipient}
              onChange={(event) => { setName(event.target.value); setMessage(''); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`recipient-id-${orderId}`}>Recipient ID number</Label>
            <Input id={`recipient-id-${orderId}`} value={idNumber} maxLength={30} autoComplete="off" placeholder="12.345.678-9" disabled={savingRecipient}
              onChange={(event) => { setIdNumber(event.target.value); setMessage(''); }} />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={savingRecipient || !name.trim() || !idNumber.trim() || (name.trim() === saved.name && idNumber.trim() === saved.idNumber)}>
          {savingRecipient ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save recipient
        </Button>
      </form>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Delivery photo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Delivery photo file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => cameraRef.current?.click()}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
          {uploading ? 'Uploading…' : 'Take delivery photo'}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <ImageUp className="mr-2 h-4 w-4" />
          Upload from device
        </Button>
      </div>
      {proofs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {proofs.map((proof) => {
            const src = `/api/orders/${orderId}/delivery-proof?pathname=${encodeURIComponent(proof.pathname)}`;
            return (
              <a key={proof.pathname} href={src} target="_blank" rel="noopener noreferrer" title={proof.uploadedAt}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Delivery proof" className="h-16 w-16 rounded object-cover border" />
              </a>
            );
          })}
        </div>
      )}
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{message}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
