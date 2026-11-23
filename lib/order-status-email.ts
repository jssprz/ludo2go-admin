import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { Resend } from 'resend';
import { prisma } from '@jssprz/ludo2go-database';
import type { FulfillmentMethod, OrderItemCancellationReason, OrderStatus } from '@prisma/client';

type OrderEmailItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  isGift: boolean;
  imageUrl?: string | null;
  cancellations: {
    quantity: number;
    reason: OrderItemCancellationReason;
  }[];
};

type OrderStatusEmailInput = {
  orderId: string;
  customerName?: string | null;
  previousStatus: OrderStatus;
  status: OrderStatus;
  fulfillmentMethod: FulfillmentMethod;
  total: number;
  currency: string;
  items: OrderEmailItem[];
  payments?: {
    method: string;
    status: string;
  }[];
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

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: 'Tarjeta',
  cash: 'Efectivo',
  transfer: 'Transferencia bancaria',
  wallet: 'Billetera digital',
  mercadopago: 'Mercado Pago',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  authorized: 'Autorizado',
  captured: 'Pagado',
  refunded: 'Reembolsado',
  failed: 'Rechazado',
};

const FULFILLMENT_METHOD_LABELS: Record<FulfillmentMethod, string> = {
  delivery: 'Despacho a domicilio',
  pickup: 'Retiro en tienda',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
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
  customerName,
  previousStatus,
  status,
  fulfillmentMethod,
  total,
  currency,
  items,
  payments = [],
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
  const fulfillmentMethodLabel = FULFILLMENT_METHOD_LABELS[fulfillmentMethod];
  const itemSummaries = items.map((item) => {
    const cancelled = item.cancellations.reduce((sum, entry) => sum + entry.quantity, 0);
    const remaining = Math.max(0, item.quantity - cancelled);
    const lineTotal = item.isGift ? 0 : remaining * item.unitPrice;
    return {
      name: item.name,
      imageUrl: safeImageUrl(item.imageUrl),
      details: [
        `Cantidad vigente: ${remaining} de ${item.quantity}`,
        ...(cancelled > 0 ? [remaining === 0 ? 'Cancelado' : `Cancelación parcial: ${cancelled} unidad(es)`] : []),
        ...(item.isGift ? ['Obsequio — Sin costo'] : []),
        `Total del producto: ${formatCurrency(lineTotal, currency)}`,
        ...item.cancellations.map((entry) =>
          `Cancelación: ${entry.quantity} unidad(es) — ${CANCELLATION_LABELS[entry.reason]}`
        ),
      ],
    };
  });
  const itemList = itemSummaries.length > 0
    ? itemSummaries.map(({ name, imageUrl, details }) =>
      `<tr>
        <td style="padding: 14px 10px 14px 0; vertical-align: top; width: 76px;">
          ${imageUrl
            ? `<img src="${escapeHtml(imageUrl)}" alt="" width="64" height="64" style="display: block; width: 64px; height: 64px; object-fit: contain; border-radius: 6px;">`
            : ''}
        </td>
        <td style="padding: 14px 0; vertical-align: top;">
          <strong>${escapeHtml(name)}</strong><br>${details.map(escapeHtml).join('<br>')}
        </td>
      </tr>`
    ).join('')
    : '<tr><td colspan="2" style="padding: 14px 0;">Productos de tu pedido</td></tr>';
  const paymentLines = payments.map(({ method, status: paymentStatus }) => {
    const methodLabel = PAYMENT_METHOD_LABELS[method.toLowerCase()] ?? method;
    const paymentStatusLabel = PAYMENT_STATUS_LABELS[paymentStatus.toLowerCase()] ?? paymentStatus;
    return `Método de pago: ${methodLabel} — ${paymentStatusLabel}`;
  });
  const subject = `Actualización de tu pedido #${orderId.slice(0, 8)}: ${statusLabel}`;
  const logoUrl = 'https://u2bzwczvuriijmfq.public.blob.vercel-storage.com/assets/jobys-logo-transparent-no-shadow-cropped.png';
  const footer = [
    'Jobys protege tu seguridad y privacidad. Nunca te pediremos información personal, como contraseñas o números de tarjeta, por correo electrónico. Si recibes una solicitud de este tipo, no respondas.',
    'Por favor, no respondas a este correo. Este buzón no está monitoreado.',
    `© ${new Date().getFullYear()} Jobys. Todos los derechos reservados.`,
  ];

  let tokenRecordId: string | undefined;
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, customer: { select: { email: true } } },
    });
    if (!order?.customer?.email) {
      console.error('Order status email not sent: stored customer email unavailable.');
      return;
    }
    const token = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const url = new URL(`/api/orders/${order.id}/access`, 'https://jobys.cl');
    url.searchParams.set('token', token);
    const orderUrl = url.toString();
    const record = await prisma.emailVerificationToken.create({
      data: {
        token: `order_access_${order.id}_${hash}`,
        customerId: order.customerId,
        email: order.customer.email,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        used: false,
      },
      select: { id: true },
    });
    tokenRecordId = record.id;
    const { error } = await resend.emails.send({
      from: orderEmailSender(process.env.RESEND_FROM_EMAIL),
      to: [order.customer.email],
      subject,
      text: [
        `Hola ${customerName?.trim() || 'cliente'},`,
        `Tu pedido #${orderId.slice(0, 8)} cambió de ${previousStatusLabel} a ${statusLabel}.`,
        `Método de entrega: ${fulfillmentMethodLabel}`,
        'Resumen de productos:',
        ...(itemSummaries.length > 0
          ? itemSummaries.map(({ name, details }) => [name, ...details].join('\n'))
          : ['Productos de tu pedido']),
        ...(paymentLines.length > 0 ? ['', 'Información de pago:', ...paymentLines] : []),
        `Total: ${formatCurrency(total, currency)}`,
        `Ver pedido: ${orderUrl}`,
        '',
        ...footer,
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
            <img src="${logoUrl}" alt="Jobys" width="130" style="display: block; width: 130px; max-width: 100%; height: auto;">
          </div>
          <h1 style="font-size: 24px; margin: 24px 0 16px;">Actualización de tu pedido</h1>
          <p>Hola <strong>${safeName}</strong>,</p>
          <p>El estado de tu pedido <strong>#${escapeHtml(orderId.slice(0, 8))}</strong> cambió de
            <strong>${previousStatusLabel}</strong> a <strong>${statusLabel}</strong>.</p>
          <p><strong>Método de entrega:</strong> ${fulfillmentMethodLabel}</p>
          <h2 style="font-size: 18px; margin: 24px 0 8px;">Resumen de productos</h2>
          <table role="presentation" style="width: 100%; border-collapse: collapse;">${itemList}</table>
          ${paymentLines.length > 0
            ? `<h2 style="font-size: 18px; margin: 24px 0 8px;">Información de pago</h2>
              <p>${paymentLines.map(escapeHtml).join('<br>')}</p>`
            : ''}
          <p style="font-size: 18px;"><strong>Total:</strong> ${escapeHtml(formatCurrency(total, currency))}</p>
          <p style="margin: 24px 0;"><a href="${escapeHtml(orderUrl)}" style="display: inline-block; padding: 10px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px;">Ver mi pedido</a></p>
          <div style="margin-top: 32px; padding-top: 18px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <p>${escapeHtml(footer[0])}</p>
            <p>${escapeHtml(footer[1])}</p>
            <p>${escapeHtml(footer[2])}</p>
          </div>
        </div>
      `,
      tags: [
        { name: 'type', value: 'order_status_update' },
        { name: 'order_status', value: status },
      ],
    });

    if (error) throw new Error('Email provider rejected the status email.');
  } catch {
    // Provider/database errors can contain the message payload or access URL.
    console.error('Order status email failed.');
    if (tokenRecordId) {
      try {
        await prisma.emailVerificationToken.update({
          where: { id: tokenRecordId },
          data: { used: true, usedAt: new Date() },
        });
      } catch {
        console.error('Failed to revoke the new order email access token.');
      }
    }
  }
}
