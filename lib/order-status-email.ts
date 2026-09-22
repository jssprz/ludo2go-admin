import 'server-only';
import { Resend } from 'resend';
import type { OrderStatus } from '@prisma/client';

type OrderStatusEmailInput = {
  orderId: string;
  customerEmail: string;
  customerName?: string | null;
  previousStatus: OrderStatus;
  status: OrderStatus;
  total: number;
  currency: string;
  itemNames: string[];
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'pendiente',
  confirmed: 'confirmado',
  processing: 'en preparación',
  shipped: 'enviado',
  delivered: 'entregado',
  cancelled: 'cancelado',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
  }).format(amount);
}

export async function sendOrderStatusNotification({
  orderId,
  customerEmail,
  customerName,
  previousStatus,
  status,
  total,
  currency,
  itemNames,
}: OrderStatusEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY is not configured; skipping order status email.');
    return;
  }

  const resend = new Resend(apiKey);
  const safeName = escapeHtml(customerName?.trim() || 'cliente');
  const statusLabel = STATUS_LABELS[status];
  const previousStatusLabel = STATUS_LABELS[previousStatus];
  const orderUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://jobys.cl'}/account/orders/${encodeURIComponent(orderId)}`;
  const safeItems = itemNames.map(escapeHtml);
  const itemList = safeItems.length > 0
    ? safeItems.map((name) => `<li>${name}</li>`).join('')
    : '<li>Productos de tu pedido</li>';
  const subject = `Actualización de tu pedido #${orderId.slice(0, 8)}: ${statusLabel}`;

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'no-reply@jobys.cl',
      to: [customerEmail],
      subject,
      text: [
        `Hola ${customerName?.trim() || 'cliente'},`,
        `Tu pedido #${orderId.slice(0, 8)} cambió de ${previousStatusLabel} a ${statusLabel}.`,
        `Total: ${formatCurrency(total, currency)}`,
        `Ver pedido: ${orderUrl}`,
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
          <h1>Actualización de tu pedido</h1>
          <p>Hola <strong>${safeName}</strong>,</p>
          <p>El estado de tu pedido <strong>#${escapeHtml(orderId.slice(0, 8))}</strong> cambió de
            <strong>${previousStatusLabel}</strong> a <strong>${statusLabel}</strong>.</p>
          <h2>Resumen</h2>
          <ul>${itemList}</ul>
          <p><strong>Total:</strong> ${escapeHtml(formatCurrency(total, currency))}</p>
          <p><a href="${orderUrl}">Ver el estado de mi pedido</a></p>
          <p style="color: #6b7280; font-size: 13px;">Este es un mensaje automático de Jobys.</p>
        </div>
      `,
      tags: [
        { name: 'type', value: 'order_status_update' },
        { name: 'order_status', value: status },
      ],
    });

    if (error) {
      console.error('Order status email failed:', error);
    }
  } catch (error) {
    console.error('Order status email failed:', error);
  }
}
