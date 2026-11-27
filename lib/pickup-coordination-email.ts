import 'server-only';
import { Resend } from 'resend';
import { prisma } from '@jssprz/ludo2go-database';
import { renderEmailTemplate } from './email-template-rendering';
import { orderEmailSender } from './order-status-email';

export const PICKUP_WHATSAPP_NUMBER = '+56 9 9542 5099';
export const PICKUP_CONTACT_EMAIL = 'jobyschile@gmail.com';

export function pickupWhatsAppUrl(orderId: string): string {
  const message = `¡Hola! Quiero coordinar el retiro de mi pedido #${orderId.slice(0, 8)} en Jobys.`;
  return `https://wa.me/56995425099?text=${encodeURIComponent(message)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

type PickupEmailInput = {
  orderId: string;
  email: string;
  customerName: string | null;
  pickupLocation: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    region: string | null;
    country: string;
    description: string | null;
  } | null;
};

/** Returns rendered stored content, or null so the built-in email is sent. */
async function renderStoredTemplate(input: PickupEmailInput, url: string) {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { key_locale: { key: 'pickup_coordination', locale: 'es-CL' } },
    });
    if (!template) return null;
    const location = input.pickupLocation;
    const orderNumber = input.orderId.slice(0, 8);
    const rendered = renderEmailTemplate(template, {
      customerName: input.customerName?.trim() || 'cliente',
      orderNumber,
      year: new Date().getFullYear(),
      pickupLocation: location ? {
        name: location.name,
        address: [location.addressLine1, location.addressLine2, location.city, location.region, location.country].filter(Boolean).join(', '),
        description: location.description,
      } : null,
      whatsappUrl: url,
      contactEmailUrl: `mailto:${PICKUP_CONTACT_EMAIL}?subject=${encodeURIComponent(`Coordinar retiro pedido #${orderNumber}`)}`,
    });
    return { ...rendered, replyTo: template.replyToEmail || PICKUP_CONTACT_EMAIL };
  } catch {
    console.error('Pickup coordination template unavailable; using built-in content.');
    return null;
  }
}

export async function sendPickupCoordinationEmail(input: PickupEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Email service is not configured.');
  const location = input.pickupLocation;
  const paragraphs = [
    `Hola ${input.customerName?.trim() || 'cliente'},`,
    `Al realizar tu pedido #${input.orderId.slice(0, 8)} en Jobys, seleccionaste retiro.`,
    `Queremos coordinar contigo el día y horario de retiro. Escríbenos por WhatsApp o al correo ${PICKUP_CONTACT_EMAIL}, indicando tu número de pedido y tu disponibilidad para que podamos confirmar los detalles. Espera nuestra confirmación antes de acudir.`,
    ...(location ? [
      `Punto de retiro seleccionado: ${location.name}`,
      [location.addressLine1, location.addressLine2, location.city, location.region, location.country].filter(Boolean).join(', '),
      ...(location.description ? [location.description] : []),
    ] : []),
    `WhatsApp de Jobys: ${PICKUP_WHATSAPP_NUMBER}`,
    `Correo de Jobys: ${PICKUP_CONTACT_EMAIL}`,
    'Jobys protege tu seguridad y privacidad. Nunca te pediremos contraseñas ni números de tarjeta por correo electrónico.',
    `Para coordinar tu retiro, contáctanos por WhatsApp o escribe a ${PICKUP_CONTACT_EMAIL}. También puedes responder a este mensaje.`,
    `© ${new Date().getFullYear()} Jobys. Todos los derechos reservados.`,
  ];
  const url = pickupWhatsAppUrl(input.orderId);
  const stored = await renderStoredTemplate(input, url);
  const { data, error } = await new Resend(apiKey).emails.send({
    from: orderEmailSender(process.env.RESEND_FROM_EMAIL),
    to: input.email,
    ...(stored ?? {
    replyTo: PICKUP_CONTACT_EMAIL,
    subject: `Coordinemos el retiro de tu pedido #${input.orderId.slice(0, 8)}`,
    text: [...paragraphs.slice(0, -3), `Coordinar por WhatsApp: ${url}`, ...paragraphs.slice(-3)].join('\n\n'),
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#111827">
      <img src="https://u2bzwczvuriijmfq.public.blob.vercel-storage.com/assets/jobys-logo-transparent-no-shadow-cropped.png" alt="Jobys" width="160">
      <h1 style="font-size:22px">Coordinemos tu retiro</h1>
      ${paragraphs.slice(0, -3).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      <p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;background:#111827;color:white;text-decoration:none;border-radius:6px">Coordinar por WhatsApp</a></p>
      <p><a href="mailto:${PICKUP_CONTACT_EMAIL}?subject=${encodeURIComponent(`Coordinar retiro pedido #${input.orderId.slice(0, 8)}`)}">Coordinar por correo: ${PICKUP_CONTACT_EMAIL}</a></p>
      <div style="border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
        ${paragraphs.slice(-3).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      </div>
    </div>`,
    }),
    tags: [{ name: 'type', value: 'pickup_coordination' }],
  });
  if (error || !data?.id) throw new Error('Email provider did not accept the pickup coordination email.');
}
