import { z } from 'zod';

export function courierTrackingUrl(template: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  if (!template?.includes('{trackingNumber}') || !trackingNumber?.trim()) return null;
  try {
    const url = new URL(template.replaceAll('{trackingNumber}', encodeURIComponent(trackingNumber.trim())));
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export const courierSchema = z.object({
  name: z.string().trim().min(1, 'Courier name is required.').max(200),
  trackingUrlTemplate: z.string().trim().nullable().transform((value) => value || null).refine(
    (value) => value === null || courierTrackingUrl(value, 'TRACKING123') !== null,
    'Use an HTTP(S) URL containing {trackingNumber}.'
  )
});