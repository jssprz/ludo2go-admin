import { z } from 'zod';

export const CUSTOMER_EMAIL_KEYS = [
  'email_verification',
  'account_activated',
  'welcome',
  'early_access_confirmation',
  'order_confirmation',
  'password_reset',
  'guest_password_setup',
  'shipping_notification',
  'product_waitlist',
  'order_status_update',
  'pickup_coordination'
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .transform((value) => value?.trim() || null);
const optionalEmail = z
  .union([z.literal(''), z.string().trim().email().max(254), z.null()])
  .transform((value) => value || null);

export const emailTemplateSchema = z
  .object({
    key: z.enum(CUSTOMER_EMAIL_KEYS),
    locale: z
      .string()
      .trim()
      .min(2)
      .max(35)
      .refine((value) => {
        try {
          return Intl.getCanonicalLocales(value).length === 1;
        } catch {
          return false;
        }
      }, 'Invalid locale')
      .transform((value) => Intl.getCanonicalLocales(value)[0]),
    name: z.string().trim().min(1).max(200),
    description: optionalText(2000),
    fromName: optionalText(200).refine(
      (value) => !value || !/[\r\n<>]/.test(value)
    ),
    fromEmail: optionalEmail,
    replyToEmail: optionalEmail,
    subjectTemplate: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .refine((value) => !/[\r\n]/.test(value)),
    htmlTemplate: z
      .string()
      .min(1)
      .max(200000)
      .refine((value) => Boolean(value.trim())),
    textTemplate: z
      .string()
      .max(100000)
      .nullable()
      .transform((value) => value || null)
  })
  .strict();

export const emailTemplateUpdateSchema = emailTemplateSchema.extend({
  updatedAt: z.string().datetime()
});

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;
export type EmailTemplateRecord = EmailTemplateInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export const newEmailTemplate: EmailTemplateInput = {
  key: 'welcome',
  locale: 'es-CL',
  name: '',
  description: null,
  fromName: null,
  fromEmail: null,
  replyToEmail: null,
  subjectTemplate: 'Bienvenido a Jobys, {{customerName}}',
  htmlTemplate: '<h1>Hola {{customerName}}</h1>\n<p>Bienvenido a Jobys.</p>',
  textTemplate: 'Hola {{customerName}}\nBienvenido a Jobys.'
};

// This is synthetic preview data, not a contract already implemented by senders.
export const emailPreviewSample = {
  customerName: 'Cliente de ejemplo',
  userName: 'Cliente de ejemplo',
  firstName: 'Cliente',
  year: 2026,
  appUrl: 'https://jobys.cl',
  verificationUrl: 'https://jobys.cl/api/auth/verify-email?token=PREVIEW_ONLY',
  resetUrl: 'https://jobys.cl/reset-password?token=PREVIEW_ONLY',
  setupUrl: 'https://jobys.cl/reset-password?token=PREVIEW_ONLY',
  expiresInHours: 24,
  discountCode: 'EJEMPLO10',
  discountPercent: 10,
  orderId: 'preview-order',
  orderNumber: 'EJEMPLO1',
  orderUrl: 'https://jobys.cl/account/orders/preview-order',
  previousStatusLabel: 'confirmado',
  statusLabel: 'en preparación',
  fulfillmentMethod: 'pickup',
  fulfillmentMethodLabel: 'Retiro en tienda',
  subtotal: '$20.000',
  shipping: '$0',
  shippingLabel: 'Retiro',
  shippingValue: 'Sin costo',
  total: '$18.000',
  promoCode: 'EJEMPLO10',
  promoDiscount: '$2.000',
  shippingAddress: 'Dirección de ejemplo, Santiago',
  items: [
    {
      name: 'Juego de ejemplo',
      quantity: 1,
      price: '$20.000',
      unitPrice: '$20.000',
      lineTotal: '$20.000',
      remaining: 1,
      isGift: false,
      imageUrl: '',
      cancellations: []
    },
    {
      name: 'Obsequio de ejemplo',
      quantity: 1,
      price: '$0',
      unitPrice: '$0',
      lineTotal: '$0',
      remaining: 1,
      isGift: true,
      imageUrl: '',
      cancellations: []
    }
  ],
  payments: [{ methodLabel: 'Transferencia bancaria', statusLabel: 'Pagado' }],
  carrier: 'Transportista de ejemplo',
  trackingNumber: 'PREVIEW123',
  trackingUrl: 'https://example.com/tracking/PREVIEW123',
  estimatedshipping: '30 de noviembre',
  productName: 'Juego de ejemplo',
  productUrl: 'https://jobys.cl/tienda',
  productImageUrl: 'https://example.com/product.png',
  logoUrl: 'https://example.com/logo.png',
  pickupLocation: {
    name: 'Punto de ejemplo',
    addressLine1: 'Dirección de ejemplo',
    addressLine2: '',
    city: 'Santiago',
    region: 'Metropolitana',
    country: 'Chile',
    description: 'Coordinar antes de acudir.'
  },
  contactEmail: 'contact@example.com',
  whatsappNumber: '+56 9 0000 0000',
  whatsappUrl: 'https://example.com/whatsapp',
  contactEmailUrl: 'mailto:contact@example.com'
};
