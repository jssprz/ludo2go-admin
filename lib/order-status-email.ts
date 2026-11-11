import 'server-only';
import { Resend } from 'resend';
import type { OrderItemCancellationReason, OrderStatus } from '@prisma/client';

type OrderEmailItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  isGift: boolean;
  cancellations: {
    quantity: number;
    reason: OrderItemCancellationReason;
  }[];
};

type OrderStatusEmailInput = {
  orderId: string;
  customerEmail: string;
  customerName?: string | null;
  previousStatus: OrderStatus;
  status: OrderStatus;
  total: number;
  currency: string;
  items: OrderEmailItem[];
};

const CANCELLATION_LABELS: Record<OrderItemCancellationReason, string> = {
  price_error: 'Error de precio',
  customer_request: 'Solicitado por el cliente',
  out_of_stock: 'Sin stock',
  duplicate: 'Producto duplicado',
  damaged: 'Producto dañado',
  other: 'Otro motivo',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'pendiente',
  confirmed: 'confirmado',
  processing: 'en preparación',
  ready_to_ship: 'listo para enviar',
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

export const ORDER_EMAIL_SENDER_NAME = 'Jobys - Juegos de Mesa';

/** Adds the store display name unless the configured sender already has one ("Name <addr>"). */
export function orderEmailSender(configured: string | undefined): string {
  const address = configured?.trim() || 'no-reply@jobys.cl';
  return address.includes('<') ? address : `${ORDER_EMAIL_SENDER_NAME} <${address}>`;
}

export async function sendOrderStatusNotification({
  orderId,
  customerEmail,
  customerName,
  previousStatus,
  status,
  total,
  currency,
  items,
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
  const orderUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.jobys.cl'}/account/orders/${encodeURIComponent(orderId)}`;
  const itemSummaries = items.map((item) => {
    const cancelled = item.cancellations.reduce((sum, entry) => sum + entry.quantity, 0);
    const remaining = Math.max(0, item.quantity - cancelled);
    const lineTotal = item.isGift ? 0 : remaining * item.unitPrice;
    return [
      item.name,
      `Cantidad vigente: ${remaining} de ${item.quantity}`,
      ...(cancelled > 0 ? [remaining === 0 ? 'Cancelado' : `Cancelación parcial: ${cancelled} unidad(es)`] : []),
      ...(item.isGift ? ['Obsequio — Sin costo'] : []),
      `Total del producto: ${formatCurrency(lineTotal, currency)}`,
      ...item.cancellations.map((entry) =>
        `Cancelación: ${entry.quantity} unidad(es) — ${CANCELLATION_LABELS[entry.reason]}`
      ),
    ];
  });
  const itemList = itemSummaries.length > 0
    ? itemSummaries.map(([name, ...details]) =>
      `<li><strong>${escapeHtml(name)}</strong><br>${details.map(escapeHtml).join('<br>')}</li>`
    ).join('')
    : '<li>Productos de tu pedido</li>';
  const subject = `Actualización de tu pedido #${orderId.slice(0, 8)}: ${statusLabel}`;

  try {
    const { error } = await resend.emails.send({
      from: orderEmailSender(process.env.RESEND_FROM_EMAIL),
      to: [customerEmail],
      subject,
      text: [
        `Hola ${customerName?.trim() || 'cliente'},`,
        `Tu pedido #${orderId.slice(0, 8)} cambió de ${previousStatusLabel} a ${statusLabel}.`,
        'Resumen de productos:',
        ...(itemSummaries.length > 0
          ? itemSummaries.map((summary) => summary.join('\n'))
          : ['Productos de tu pedido']),
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
