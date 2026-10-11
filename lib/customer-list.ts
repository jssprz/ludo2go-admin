export type CustomerListTab = 'customers' | 'visitors';
export type CustomerListSort = 'name' | 'email' | 'ltv' | 'orders' | 'lastPurchase' | 'lastActivity' | 'cartValue' | 'risk';
export type CustomerSegment = 'new' | 'repeat' | 'vip' | 'inactive' | 'atRisk';
export type CustomerRisk = 'high' | 'medium' | 'low' | 'insufficient';
export type CustomerQualityFlag = 'invalidEmail' | 'testAccount' | 'incomplete' | 'duplicate';
export type CustomerListView = 'attention' | 'activeCarts' | 'abandoned' | 'repeat' | 'vip' | 'inactive' | 'quality';

export interface CustomerListQuery {
  q: string;
  tab: CustomerListTab;
  size: 20 | 50 | 100;
  offset: number;
  sort: CustomerListSort;
  order: 'asc' | 'desc';
  segment?: CustomerSegment;
  activity?: '7' | '30' | '90' | 'inactive';
  purchase?: 'none' | 'one' | 'repeat';
  cart?: 'active' | 'abandoned';
  risk?: 'high' | 'insufficient';
  quality?: 'flagged' | 'duplicate' | 'internal';
  view?: CustomerListView;
}

export interface CustomerListRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  segment: CustomerSegment | null;
  ltv: number;
  currency: string;
  ordersCount: number;
  aov: number;
  lastPurchase: string | null;
  lastActivity: string | null;
  cartValue: number;
  cartCount: number;
  abandoned: boolean;
  risk: CustomerRisk;
  quality: CustomerQualityFlag[];
  activitySummary: Record<string, number>;
}

export interface AnonymousVisitorRow {
  id: string;
  createdAt: string;
  lastActivity: string | null;
  sessionsCount: number;
  eventsCount: number;
  currency: 'CLP';
  cartValue: number;
  cartCount: number;
  abandoned: boolean;
  activitySummary: Record<string, number>;
}

export interface CustomerListPage {
  customers: CustomerListRow[];
  visitors: AnonymousVisitorRow[];
  totalCustomers: number;
  totalVisitors: number;
  filteredTotal: number;
  kpis: { total: number; new30: number; repeat: number; activeCarts: number; atRisk: number };
}

type QueryInput = URLSearchParams | Record<string, string | string[] | undefined>;

export function parseCustomerListQuery(input: QueryInput): CustomerListQuery {
  const get = (key: string): string | undefined => {
    const value = input instanceof URLSearchParams ? input.get(key) : input[key];
    return Array.isArray(value) ? value[0] : value ?? undefined;
  };
  const pick = <Value extends string>(key: string, values: readonly Value[]): Value | undefined => {
    const value = get(key);
    return values.includes(value as Value) ? value as Value : undefined;
  };
  const sizeText = pick('size', ['20', '50', '100'] as const);
  const size = Number(sizeText ?? 20) as CustomerListQuery['size'];
  const offsetText = get('offset') ?? '0';
  const offset = /^\d+$/.test(offsetText) ? Math.min(Number(offsetText), 1_000_000) : 0;
  const view = pick('view', ['attention', 'activeCarts', 'abandoned', 'repeat', 'vip', 'inactive', 'quality'] as const);
  const presets: Record<CustomerListView, Partial<CustomerListQuery>> = {
    attention: { risk: 'high' }, activeCarts: { cart: 'active' },
    abandoned: { cart: 'abandoned' }, repeat: { purchase: 'repeat' },
    vip: { segment: 'vip' }, inactive: { activity: 'inactive' },
    quality: { quality: 'flagged' }
  };
  return {
    q: (get('q') ?? '').trim().slice(0, 200),
    tab: pick('tab', ['customers', 'visitors'] as const) ?? 'customers',
    size,
    offset: Math.floor(offset / size) * size,
    sort: pick('sort', ['name', 'email', 'ltv', 'orders', 'lastPurchase', 'lastActivity', 'cartValue', 'risk'] as const) ?? 'lastActivity',
    order: pick('order', ['asc', 'desc'] as const) ?? 'desc',
    ...(view ? { view, ...presets[view] } : {}),
    ...(pick('segment', ['new', 'repeat', 'vip', 'inactive', 'atRisk'] as const) ? { segment: pick('segment', ['new', 'repeat', 'vip', 'inactive', 'atRisk'] as const) } : {}),
    ...(pick('activity', ['7', '30', '90', 'inactive'] as const) ? { activity: pick('activity', ['7', '30', '90', 'inactive'] as const) } : {}),
    ...(pick('purchase', ['none', 'one', 'repeat'] as const) ? { purchase: pick('purchase', ['none', 'one', 'repeat'] as const) } : {}),
    ...(pick('cart', ['active', 'abandoned'] as const) ? { cart: pick('cart', ['active', 'abandoned'] as const) } : {}),
    ...(pick('risk', ['high', 'insufficient'] as const) ? { risk: pick('risk', ['high', 'insufficient'] as const) } : {}),
    ...(pick('quality', ['flagged', 'duplicate', 'internal'] as const) ? { quality: pick('quality', ['flagged', 'duplicate', 'internal'] as const) } : {})
  };
}

export function normalizeCustomerListEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeCustomerListPhone(value: string | null | undefined): string {
  let digits = (value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^9\d{8}$/.test(digits)) return `56${digits}`;
  return digits;
}

export function normalizeCustomerListName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function customerQualityFlags(input: { email: string; firstName?: string | null; lastName?: string | null; username?: string | null; phone?: string | null }, duplicate = false): CustomerQualityFlag[] {
  const email = normalizeCustomerListEmail(input.email);
  const flags: CustomerQualityFlag[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) flags.push('invalidEmail');
  if (/(^|[^a-z])(test|demo|example|localhost|invalid)([^a-z]|$)/i.test([email, input.firstName, input.lastName, input.username].join(' '))) flags.push('testAccount');
  if (!input.firstName?.trim() || !input.lastName?.trim() || !input.phone?.trim()) flags.push('incomplete');
  if (duplicate) flags.push('duplicate');
  return flags;
}

export type CustomerDuplicateReason = 'email' | 'phone' | 'name';
export interface CustomerDuplicateIdentity {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  href: string;
}
export interface CustomerDuplicateCandidate {
  customer: CustomerDuplicateIdentity;
  candidate: CustomerDuplicateIdentity;
  reasons: CustomerDuplicateReason[];
}
export interface CustomerDuplicatePage {
  candidates: CustomerDuplicateCandidate[];
  total: number;
  size: number;
  offset: number;
  mergeAllowed: false;
}

export interface CustomerDuplicateReview {
  candidate: CustomerDuplicateCandidate;
  mergeAllowed: false;
  reviewPersisted: false;
  blockedReason: 'relationshipConflictReviewRequired';
}

export function parseCustomerListReviewIds(input: URLSearchParams): { customerId: string; candidateId: string } | null {
  const customerId = input.get('customerId') ?? '';
  const candidateId = input.get('candidateId') ?? '';
  const validId = /^[a-zA-Z0-9_-]{1,200}$/;
  return validId.test(customerId) && validId.test(candidateId) && customerId !== candidateId
    ? { customerId, candidateId } : null;
}

export function customerDuplicateReasons(first: { email: string; phone?: string | null; name: string }, second: { email: string; phone?: string | null; name: string }): CustomerDuplicateReason[] {
  const reasons: CustomerDuplicateReason[] = [];
  const email = normalizeCustomerListEmail(first.email);
  const phone = normalizeCustomerListPhone(first.phone);
  const name = normalizeCustomerListName(first.name);
  if (email && email === normalizeCustomerListEmail(second.email)) reasons.push('email');
  if (phone.length >= 8 && phone === normalizeCustomerListPhone(second.phone)) reasons.push('phone');
  if (name.includes(' ') && name === normalizeCustomerListName(second.name)) reasons.push('name');
  return reasons;
}