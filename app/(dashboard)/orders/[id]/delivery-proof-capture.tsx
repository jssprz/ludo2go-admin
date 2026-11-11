'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ImageUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type DeliveryProofSummary = { pathname: string; uploadedAt: string };

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

export function DeliveryProofCapture({ orderId, proofs }: { orderId: string; proofs: DeliveryProofSummary[] }) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');

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
