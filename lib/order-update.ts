import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const trackingEditableStatuses: OrderStatus[] = ['ready_to_ship', 'shipped', 'delivered', 'cancelled'];

export const orderUpdateSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  courierTrackingNumber: z.string().trim().nullable().optional()
}).refine((value) => value.status !== undefined || value.courierTrackingNumber !== undefined, 'Provide an order status or tracking number');

export function canEditOrderTracking(status: OrderStatus): boolean {
  return trackingEditableStatuses.includes(status);
}