export interface VisitorEventDetails {
  events: Array<{ type: string; count: number }>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    occurredAt: string;
    sessionId: string;
    pagePath: string | null;
    reference: { kind: 'search' | 'name'; value: string } | null;
    guestInfo?: {
      email: string | null;
      fullName: string | null;
      notifications: boolean | null;
    } | null;
  }>;
  hasMoreEvents: boolean;
  guestCheckouts: Array<{
    id: string;
    occurredAt: string;
    email: string | null;
    fullName: string | null;
    notifications: boolean | null;
  }>;
  hasMoreGuestCheckouts: boolean;
}

export function parseVisitorEventsQuery(
  params: URLSearchParams
): { id: string } | null {
  if (params.getAll('id').length !== 1) return null;
  const id = params.get('id');
  if (!id || id.length > 200 || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return { id };
}

export function parseVisitorGuestCheckoutProperties(
  value: unknown
): Pick<
  VisitorEventDetails['guestCheckouts'][number],
  'email' | 'fullName' | 'notifications'
> {
  let parsed: unknown = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  const properties =
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  const ownValue = (key: string): unknown =>
    Object.prototype.hasOwnProperty.call(properties, key)
      ? properties[key]
      : null;
  const boundedString = (key: string, limit: number): string | null => {
    const field = ownValue(key);
    return typeof field === 'string'
      ? field.trim().slice(0, limit) || null
      : null;
  };
  const notifications = ownValue('notifications');
  return {
    email: boundedString('email', 320),
    fullName: boundedString('full_name', 200),
    notifications: typeof notifications === 'boolean' ? notifications : null
  };
}
