import { OrderItemCancellationReason, OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const trackingEditableStatuses: OrderStatus[] = ['ready_to_ship', 'shipped', 'delivered', 'cancelled'];

const addItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  isGift: z.boolean().optional(),
  giftReason: z.string().trim().max(500).nullable().optional(),
}).transform((value) => ({
  variantId: value.variantId,
  quantity: value.quantity,
  unitPrice: value.unitPrice,
  isGift: value.isGift ?? false,
  giftReason: value.isGift ? value.giftReason?.trim() || null : null,
})).refine(
  (value) => !value.isGift || Boolean(value.giftReason?.trim()),
  'Gift reason is required when the item is marked as gift.'
);

const cancelItemSchema = z.object({
  orderItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  reason: z.nativeEnum(OrderItemCancellationReason),
  details: z.string().trim().max(500).nullable().optional(),
}).transform((value) => ({
  ...value,
  details: value.details?.trim() || null,
}));

const giftItemSchema = z.object({
  orderItemId: z.string().uuid(),
  isGift: z.boolean(),
  giftReason: z.string().trim().max(500).nullable().optional(),
}).transform((value) => ({
  ...value,
  giftReason: value.isGift ? value.giftReason?.trim() || null : null,
})).refine(
  (value) => !value.isGift || Boolean(value.giftReason?.trim()),
  'Gift reason is required when the item is marked as gift.'
);

export const orderUpdateSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  courierId: z.string().uuid().nullable().optional(),
  courierTrackingNumber: z.string().trim().nullable().optional(),
  addItem: addItemSchema.optional(),
  cancelItem: cancelItemSchema.optional(),
  giftItem: giftItemSchema.optional(),
}).refine(
  (value) => (
    value.status !== undefined
    || value.courierTrackingNumber !== undefined
    || value.courierId !== undefined
    || value.addItem !== undefined
    || value.cancelItem !== undefined
    || value.giftItem !== undefined
  ),
  'Provide an order status, courier, tracking number, or item update'
).refine(
  (value) => [value.addItem, value.cancelItem, value.giftItem].filter((entry) => entry !== undefined).length <= 1,
  'Only one item operation is allowed per request.'
);

export function canEditOrderTracking(status: OrderStatus): boolean {
  return trackingEditableStatuses.includes(status);
}