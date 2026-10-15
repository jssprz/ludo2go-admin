import { z } from 'zod';

const scheduleSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'published', 'archived']),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional()
});

export function parseGuideSchedule(status: unknown, scheduledAt: unknown, now = new Date()) {
  const result = scheduleSchema.safeParse({ status, scheduledAt });
  if (!result.success) return { error: 'Invalid guide status or scheduling date', scheduledAt: null };
  if (result.data.status !== 'scheduled') return { scheduledAt: null };
  if (!result.data.scheduledAt) return { error: 'A publishing date is required for scheduled guides', scheduledAt: null };
  const date = new Date(result.data.scheduledAt);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now.getTime()) return { error: 'Publishing date must be in the future', scheduledAt: null };
  return { scheduledAt: date };
}

export function guideScheduleInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}