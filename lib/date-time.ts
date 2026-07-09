export const ADMIN_TIME_ZONE_COOKIE = 'admin_time_zone';
export const DEFAULT_ADMIN_TIME_ZONE = 'UTC';

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_ADMIN_TIME_ZONE;
  const trimmed = timeZone.trim();
  if (!trimmed) return DEFAULT_ADMIN_TIME_ZONE;
  return isValidTimeZone(trimmed) ? trimmed : DEFAULT_ADMIN_TIME_ZONE;
}

export function formatDateInTimeZone(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions,
  locale: string,
  timeZone: string
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone,
  }).format(date);
}
