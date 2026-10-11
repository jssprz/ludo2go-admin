export const PROFILE_EVENT_CATEGORIES = [
  'all',
  'navigation',
  'catalog',
  'cart',
  'checkout',
  'search',
  'match',
  'account',
  'other'
] as const;
export type ProfileEventCategory = (typeof PROFILE_EVENT_CATEGORIES)[number];

const categories: Record<string, ProfileEventCategory> = {
  page_view: 'navigation',
  product_impression: 'catalog',
  product_view: 'catalog',
  variant_view: 'catalog',
  add_to_cart: 'cart',
  remove_from_cart: 'cart',
  begin_checkout: 'checkout',
  checkout_guest_info_complete: 'checkout',
  checkout_add_shipping_info: 'checkout',
  checkout_select_payment_method: 'checkout',
  checkout_login: 'checkout',
  purchase: 'checkout',
  search_performed: 'search',
  search_result_click: 'search',
  typeahead_performed: 'search',
  typeahead_result_click: 'search',
  match_tool_start: 'match',
  match_tool_option_click: 'match',
  match_tool_result_click: 'match',
  signup: 'account',
  login: 'account'
};

export function normalizeProfileEvent(eventType: string) {
  const normalized = eventType
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const category =
    categories[normalized] ??
    (/search|typeahead/.test(normalized)
      ? 'search'
      : /checkout|purchase|payment/.test(normalized)
        ? 'checkout'
        : /cart/.test(normalized)
          ? 'cart'
          : /product|variant/.test(normalized)
            ? 'catalog'
            : /match/.test(normalized)
              ? 'match'
              : /login|signup|account/.test(normalized)
                ? 'account'
                : /page|navigation/.test(normalized)
                  ? 'navigation'
                  : 'other');
  return {
    category,
    labelKey: categories[normalized]
      ? `events.${normalized}`
      : `categories.${category}`
  };
}

export function profileEventReference(properties: unknown) {
  if (
    !properties ||
    typeof properties !== 'object' ||
    Array.isArray(properties)
  )
    return null;
  const values = properties as Record<string, unknown>;
  for (const key of [
    'productName',
    'variantName',
    'query',
    'rawQuery',
    'searchQuery',
    'optionLabel'
  ]) {
    const value = values[key];
    if (typeof value === 'string' && value.trim())
      return {
        kind: key.includes('Query') || key === 'query' ? 'search' : 'name',
        value: value.trim().slice(0, 200)
      };
  }
  return null;
}

export function groupProfileSessions<
  Event extends { sessionId: string; occurredAt: string }
>(events: Event[]) {
  const sessions = new Map<string, Event[]>();
  for (const event of [...events].sort(
    (first, second) =>
      Date.parse(second.occurredAt) - Date.parse(first.occurredAt)
  )) {
    const session = sessions.get(event.sessionId) ?? [];
    session.push(event);
    sessions.set(event.sessionId, session);
  }
  return Array.from(sessions, ([id, sessionEvents]) => ({
    id,
    events: sessionEvents
  }));
}
