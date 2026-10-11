# Customer customer management Data Contract

Scope: customer-list data and non-destructive duplicate review only. No UI,
global translations, preference endpoints, create dialog, migrations, schema
changes, customer writes, or persisted review decisions are included.

## Integration

Import `parseCustomerListQuery` and types from `lib/customer-list.ts`; import the server-only
`getCustomerListPage` from `lib/repositories/customer-list.ts`. The calling dashboard
must enforce its admin access boundary. Duplicate APIs enforce their own boundary.

```ts
const query = parseCustomerListQuery(await searchParams);
const page = await getCustomerListPage(query);
```

Exact exported row and page contracts:

```ts
type CustomerListTab = 'customers' | 'visitors';
type CustomerListSort = 'name' | 'email' | 'ltv' | 'orders' | 'lastPurchase' | 'lastActivity' | 'cartValue' | 'risk';
type CustomerSegment = 'new' | 'repeat' | 'vip' | 'inactive' | 'atRisk';
type CustomerRisk = 'high' | 'medium' | 'low' | 'insufficient';
type CustomerQualityFlag = 'invalidEmail' | 'testAccount' | 'incomplete' | 'duplicate';
type CustomerListView = 'attention' | 'activeCarts' | 'abandoned' | 'repeat' | 'vip' | 'inactive' | 'quality';

interface CustomerListQuery {
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

interface CustomerListRow {
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

interface AnonymousVisitorRow {
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

interface CustomerListPage {
  customers: CustomerListRow[];
  visitors: AnonymousVisitorRow[];
  totalCustomers: number;
  totalVisitors: number;
  filteredTotal: number;
  kpis: { total: number; new30: number; repeat: number; activeCarts: number; atRisk: number };
}
```

Dates are ISO timestamp strings from PostgreSQL JSON, not `Date` objects. Parse
them before passing to date formatters that require `Date`. The non-selected tab
returns an empty array, not a second page. Counts include empty/out-of-range pages.
`totalCustomers` counts all accounts; `totalVisitors` counts eligible anonymous
visitors; `filteredTotal` counts the selected tab after its filters. KPIs are
global customer counts, unaffected by search, filters, pagination, or selected tab.

## Query Rules

`parseCustomerListQuery(input)` accepts `URLSearchParams` or
`Record<string, string | string[] | undefined>`. Array values use their first
element. Defaults: customers, size 20, offset 0, lastActivity descending. Search
is trimmed to 200 characters and interpreted literally, including `%`, `_`,
and backslashes. Offset is non-negative integer text, capped at 1,000,000 and
rounded down to a page boundary. Invalid enums are discarded/defaulted.

Preset mappings: attention -> high risk; activeCarts -> active cart;
abandoned -> abandoned cart; repeat -> repeat purchases; vip -> VIP segment;
inactive -> inactive activity; quality -> flagged quality. Valid explicit filters
override a preset for the same field. Other filters combine with AND.

Customer sort columns: lowercased name/email, currency-scoped LTV, delivered
orders count, last purchase/activity, active cart value, risk rank. Ascending
risk rank is insufficient, low, medium, high; descending reverses it. Nulls sort
last, and ID ascending breaks every tie. Visitor name/email sort uses ID;
cartValue uses active cart value; other sorts fall back to lastActivity.

Visitor activity/cart filters work normally. Anonymous visitors have zero
purchases and insufficient risk, so `purchase=none` and `risk=insufficient`
remain eligible. Other purchase/risk filters, all segments, and all customer
quality filters yield zero visitors rather than silently ignoring those filters.

## Metrics And Attribution

- Currency: trimmed preferred currency, default CLP. Delivered orders in other
  currencies do not enter LTV, AOV, order count, last purchase, or risk.
- LTV: sum each delivered order's total less positive same-currency refunded
  payments, clamped to zero per order. Fully refunded delivered orders still
  count as delivered purchases. Amounts remain schema minor units.
- Cart count: nonempty active carts. Cart value: sum of non-negative quantities
  times non-negative unit prices for active carts. Abandoned means at least one
  nonempty explicitly abandoned cart; no inferred timeout or abandoned value.
- Price fallback: current active unscoped `retail` price matching the row currency,
  newest creation timestamp then ID. The installed enum has no `standard` value.
  Sale/member/rule prices and channel, price-book, or regional prices are excluded.
- Last activity: maximum attributed event timestamp, safely attributed session
  lastActivityAt, delivered purchase timestamp, or active/abandoned cart update.
  An account with none of these has null lastActivity; inactivity uses createdAt
  as the fallback. `activity=7|30|90` uses lastActivity, not account creation.
- Activity summary: counts keyed by EventType across all attributed history,
  not payloads, raw events, or inferred interests.
- Event ownership: explicit customerId wins. Otherwise attribute to the unique
  identified customer in the session, or, if absent, unique identified customer
  across the visitor's sessions. Ambiguous history is not attributed. Explicit
  identified events remain assigned even on shared visitors.
- Anonymous eligibility: exclude visitors with ANY identified Event.customerId
  through Session, even visitors with multiple distinct customers. No-session
  visitors remain eligible. Customer IDs are not inferred from event properties.
- Cart ownership: explicit customerId wins; otherwise unique visitor attribution.
  Anonymous totals include only carts without an explicit/derived customer owner.
  No visitor, session, event, or cart records are mutated.

## Segments And KPIs

These are transparent heuristics, not calibrated churn probabilities:

- New: account created in the last 30 days (`new30` KPI).
- Repeat: at least two delivered purchases in the selected currency (`repeat` KPI).
- VIP: at least five delivered purchases and last purchase within 60 days.
- Inactive: no activity within 90 days, using creation when activity is null.
- Risk: insufficient with fewer than three delivered purchases or zero purchase
  interval; otherwise high after 150 days since last purchase, medium after 90
  days or more than twice the historical average purchase interval, else low.
- At risk: high risk only (`atRisk` KPI and attention view).
- Row segment priority: atRisk, inactive, vip, repeat, new, then null. Segment
  filters independently test their definition, so a VIP also matches repeat.
- `activeCarts` KPI counts customers with nonempty active carts, not carts or
  visitors. `total` KPI equals totalCustomers. Quality flags do not exclude accounts
  from metrics unless explicitly filtered.

## Quality And Duplicate Review

Invalid email is a syntax hint, not deliverability verification. Test accounts
match boundary-separated test/demo/example/localhost/invalid tokens in email,
names, or username. Incomplete means missing first name, last name, or phone.
`quality=internal` means testAccount, not verified staff membership.

Duplicate reasons are equal trimmed lowercase email, normalized phone of at
least eight digits, or equal lowercase whitespace-collapsed two-part names.
Phone normalization strips punctuation and international 00; Chilean local
9xxxxxxxx becomes 569xxxxxxxx. It does not strip email plus tags/dots, perform
fuzzy matching, remove accents, infer arbitrary country codes, or prove identity.
Name/shared-household-phone matches can be false positives.

`GET /api/customers/duplicates?q=&size=20&offset=0` returns `CustomerDuplicatePage`:

```ts
type CustomerDuplicateReason = 'email' | 'phone' | 'name';
interface CustomerDuplicateIdentity {
  id: string; email: string; name: string; phone: string | null; href: string;
}
interface CustomerDuplicateCandidate {
  customer: CustomerDuplicateIdentity;
  candidate: CustomerDuplicateIdentity;
  reasons: CustomerDuplicateReason[];
}
interface CustomerDuplicatePage {
  candidates: CustomerDuplicateCandidate[];
  total: number; size: number; offset: number; mergeAllowed: false;
}
interface CustomerDuplicateReview {
  candidate: CustomerDuplicateCandidate;
  mergeAllowed: false;
  reviewPersisted: false;
  blockedReason: 'relationshipConflictReviewRequired';
}
```

Pairs are returned once in canonical ID order with reasons and `/customers/:id`
profile links. List supports q/size/offset; other customer management filters do not apply to this
candidate list. `GET /api/customers/duplicates/review?customerId=...&candidateId=...`
returns `CustomerDuplicateReview`, 400 for malformed/same IDs, 404 for no matching pair.
`POST /api/customers/duplicates/review` returns 409 `mergeBlocked` for a verified
admin. Review reads do not record an acknowledgement, ignore flag, or decision.

Both endpoints require an authenticated session ID AND an AdminUser that still
exists in the current database. No customer information is returned before this
check. Responses are private/no-store; 401 unauthorized, 403 forbidden, and
503 customerListUnavailable are machine-readable codes without raw errors.

Merge is blocked: safe consolidation must resolve unique username/email and
preferred-address, wishlist, collection, saved-list ownership conflicts; address,
order, review/vote, cart, membership, rental, social, verification-token, and
event relationships; plus optional customer management note/audit relationships. There is no
comprehensive conflict-resolution transaction or supported schema migration here.
Use profile links for non-destructive operator review; do not delete accounts or
reassign relationships through these APIs.

## Exported Functions

Pure module exports `parseCustomerListQuery`, `normalizeCustomerListEmail`, `normalizeCustomerListPhone`,
`normalizeCustomerListName`, `customerQualityFlags`, `customerDuplicateReasons`, `parseCustomerListReviewIds`.
All types shown above are exported.

Server repository exports:

```ts
getCustomerListPage(input: CustomerListQuery, database?: ReadDatabase): Promise<CustomerListPage>;
getCustomerDuplicateCandidates(input: CustomerListQuery, customerId?: string, candidateId?: string, database?: ReadDatabase): Promise<CustomerDuplicatePage>;
getCustomerDuplicateReview(customerId: string, candidateId: string, database?: ReadDatabase): Promise<CustomerDuplicateReview | null>;
buildCustomerListSql(input: CustomerListQuery): Prisma.Sql;
buildCustomerDuplicateSql(input: CustomerListQuery, customerId?: string, candidateId?: string): Prisma.Sql;
requireCustomerAdmin(dependencies?: AdminAccessDependencies): Promise<void>;
```

Optional database/admin dependencies support read-only test doubles. Production
uses the installed shared Prisma client. SQL is parameterized with fixed column
whitelists; all aggregates/filters/sorts occur before LIMIT. A single statement
returns each page with global counts/KPIs from one snapshot, including empty pages.

## Validation And Limitations

```sh
NODE_OPTIONS='--conditions=react-server' npx tsx --test tests/customerCustomerList*.test.ts
```

Tests make no database writes or external database calls. They verify parser and
identity helpers, SQL parameterization/filter/sort/attribution structure, installed
Prisma field/enum metadata, one-query page behavior, current-admin verification,
and non-destructive review/error handling. They do not execute SQL or authenticate
against the live database. The configured Prisma client failed initialization
during a read-only EXPLAIN attempt; an optional isolated PostgreSQL validator
installation was skipped. Validate EXPLAIN and representative SELECTs in the
deployment environment before relying on production metrics.

The page bounds returned data, not aggregate scan cost: Event/Order/Session
history and normalized identity groups must still be scanned. Duplicate counts
may be expensive for very large shared-name/placeholder groups. No indexes or
schema were added. Assess production EXPLAIN plans and latency before deciding on
an indexed materialization or a migration.

CartItem.unitPriceAtAdd has no currency field. It is treated as the owner's
preferred/default currency; this is an unavoidable data-model assumption, not
verified FX conversion. Missing fallback prices contribute zero, not an invented
amount. Cross-currency global LTV/cart sorting orders numeric amounts without FX;
do not interpret it as a common-currency ranking or sum those rows into revenue.
Refund amounts represent refunded Payment rows, not an invented partial-refund
ledger. Addresses/reviews and detailed event payloads remain profile-only.