'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export function PickupCoordinationButton({ orderId, email }: { orderId: string; email: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const sending = useRef(false);

  async function send() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/orders/${orderId}/pickup-coordination`, { method: 'POST' });
      const result: { message?: string } | null = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || 'No se pudo enviar el correo.');
      setMessage('Correo de coordinación enviado.');
      setConfirming(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo enviar el correo.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" disabled={!email || busy} onClick={() => {
        setConfirming(true);
        setMessage('');
        setError('');
      }}>
        Coordinar retiro por correo
      </Button>
      {!email && <p className="text-sm text-muted-foreground">El cliente no tiene un correo registrado.</p>}
      {confirming && (
        <div className="space-y-2 text-sm">
          <p>Enviar a {email} una solicitud para coordinar el retiro seleccionado, con el punto de retiro y nuestro WhatsApp +56 9 9542 5099. No se enviará una confirmación de que el pedido está listo.</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar correo'}</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</Button>
          </div>
        </div>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
