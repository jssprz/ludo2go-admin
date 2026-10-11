import type { CustomerListTab } from '@/lib/customer-list';
import {
  CUSTOMER_LIST_COLUMNS,
  type CustomerListColumn
} from '@/lib/customer-list-preferences';
export {
  CUSTOMER_LIST_COLUMNS,
  DEFAULT_COLUMNS,
  EMPTY_CUSTOMER_LIST_PREFERENCES,
  type CustomerListColumn,
  type CustomerListPreferences
} from '@/lib/customer-list-preferences';
export const CUSTOMER_LIST_VIEWS = [
  'attention',
  'activeCarts',
  'abandoned',
  'repeat',
  'vip',
  'inactive',
  'quality'
] as const;
export const CUSTOMER_FILTERS = [
  'segment',
  'activity',
  'purchase',
  'cart',
  'risk',
  'quality',
  'view',
  'savedView'
] as const;

export function normalizeColumns(
  columns: readonly string[]
): CustomerListColumn[] {
  return CUSTOMER_LIST_COLUMNS.filter((column) => columns.includes(column));
}

export function updateCustomerListUrl(
  current: URLSearchParams,
  changes: Record<string, string | null>,
  resetOffset = true
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (resetOffset) next.delete('offset');
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
  }
  return next;
}

export function changeCustomerListTab(
  current: URLSearchParams,
  tab: CustomerListTab
): URLSearchParams {
  return updateCustomerListUrl(current, {
    tab,
    ...Object.fromEntries(CUSTOMER_FILTERS.map((key) => [key, null]))
  });
}

export function applyCustomerListView(
  current: URLSearchParams,
  query: Record<string, string>,
  id: string,
  saved = false
): URLSearchParams {
  const next = updateCustomerListUrl(
    current,
    Object.fromEntries(
      [...CUSTOMER_FILTERS, 'q', 'sort', 'order', 'size'].map((key) => [
        key,
        null
      ])
    )
  );
  const allowed = new Set<string>([
    ...CUSTOMER_FILTERS,
    'q',
    'sort',
    'order',
    'size',
    'columns'
  ]);
  for (const [key, value] of Object.entries(query)) {
    if (allowed.has(key) && key !== 'savedView') next.set(key, value);
  }
  next.set('tab', 'customers');
  next.set(saved ? 'savedView' : 'view', id);
  return next;
}

export function canApplyDefaultView(current: URLSearchParams): boolean {
  return current.size === 0;
}

export function savedCustomerListQuery(
  current: URLSearchParams
): Record<string, string> {
  const allowed = new Set<string>([
    ...CUSTOMER_FILTERS,
    'q',
    'sort',
    'order',
    'size',
    'columns'
  ]);
  return Object.fromEntries(
    Array.from(current.entries()).filter(
      ([key]) => allowed.has(key) && key !== 'savedView'
    )
  );
}

export function summarizeCustomerListActivity(
  summary: Record<string, number>
): {
  entries: Array<[string, number]>;
  remaining: number;
} {
  const entries = Object.entries(summary)
    .filter(([, count]) => count > 0)
    .sort(
      ([firstType, firstCount], [secondType, secondCount]) =>
        secondCount - firstCount || firstType.localeCompare(secondType)
    );
  return {
    entries: entries.slice(0, 3),
    remaining: Math.max(0, entries.length - 3)
  };
}
