# Customer Profile

## Scope and Database Setup

The profile owns its UI, metric helpers and notes endpoints. Customer list and profile translations live in the existing central locale catalogs under `messages/en.json` and `messages/es.json`.

The installed database package includes `CustomerNote`, `CustomerNoteAudit` and `AdminCustomerListPreference`. Notes use parameterized SQL; list preferences use the generated Prisma model. Neither feature stores internal data in Customer marketing preferences or Event properties.

The three tables were verified in the connected database using read-only inspection. `docs/customer-profile-migration.sql` describes initial setup:

- `CustomerNote`: customer FK, text body, author/editor IDs and name snapshots, UTC-aware creation/edit/deletion timestamps, positive integer version.
- `CustomerNoteAudit`: immutable-in-application create/edit/delete snapshots with actor, version and exact timestamp. The API never updates or deletes audit rows.
- `AdminCustomerListPreference`: one row per administrator, JSONB object, integer version, creation/update timestamps. Stores columns, saved views and the pinned default view through the preferences API.

The inspected database lacks some CHECK constraints and the customer-note listing index. An authorized operator should review and apply `docs/customer-storage-safeguards.sql` through the established database migration process. It adds and validates these safeguards without changing existing rows. Validation fails and rolls back if existing data violates a constraint. This follow-up migration has not been applied by the assistant; record the changes in the shared database migration history.

All FKs reference the existing text IDs and use RESTRICT, not cascade or merge. No customer relation or dependency schema is modified. `CREATE TABLE IF NOT EXISTS` does not repair incompatible pre-existing tables: verify columns and constraints before deployment. Use the established deployment procedure for the target database; do not run Prisma db push or generate a destructive migration from the dependency schema.

The application database role needs SELECT/INSERT/UPDATE on notes and SELECT/INSERT on note audit. Audit access should be limited to authorized operators; body snapshots contain internal customer information. No production grants, retention rules or schema mutations are applied by this change.

Missing notes/audit tables return HTTP 503 `{ "code": "setupRequired" }`, rendered as a localized setup-required error, not as an empty note collection. Other failures return generic codes without SQL, connection values or customer data. There is no silent localStorage fallback.

## Notes Contract

- GET `/api/customers/:id/notes`: `{ notes: [...] }`; active notes only, newest first. Each note includes `canManage`, author/editor snapshots, timestamps and `version`. Responses are no-store.
- POST: `{ body }`; returns 201 `{ id }`. Trimmed content must be 1-10,000 characters. The server obtains the author from the active AdminUser behind the session; client author fields are rejected.
- PATCH `/api/customers/:id/notes/:noteId`: `{ body, version }`.
- DELETE on the same path: `{ version }`; soft deletion only, preserving body and audit history.

Existing administrators can read and create notes. Only the original author or a current role key of `SUPER_ADMIN` can edit/remove them. Roles are read from the database for every request, not trusted from a cached JWT. This is an explicit profile policy, not an assertion of a global permission framework. Non-authenticated, revoked, missing, forbidden and stale-version cases return 401, 403, 404, 403 and 409 respectively. Writes require JSON and reject cross-origin browser requests.

Mutation SQL locks the customer-scoped note row and checks the version before writing. Note updates and their audit entries share one transaction; a failed audit insert rolls the mutation back. Audit versions are unique per note.

Legacy notes are detected under `customer-notes-<customerId>`, previewed and imported only after an explicit action. Local content is removed only after a confirmed server success. Import attribution records the importing administrator and import time, not a fabricated original author/time. A lost POST response can lead to a duplicate on retry; import/create is not idempotent across network failures. Existing profile tags remain browser-local and are not represented as shared server data.

## List Preferences

`AdminCustomerListPreference` uses this contract:

| Column                | Type                           | Contract                              |
| --------------------- | ------------------------------ | ------------------------------------- |
| adminUserId           | TEXT primary key, AdminUser FK | derive from the authenticated session |
| preferences           | JSONB object                   | main owns validation and allowed keys |
| version               | INTEGER, starts at 1           | use optimistic locking on update      |
| createdAt / updatedAt | TIMESTAMPTZ                    | update updatedAt explicitly on writes |

The row belongs to an administrator, not a customer, and does not modify Customer marketing/fulfillment preferences.

- GET `/api/customers/preferences` returns `{ preferences, version }`. An absent row returns compact default columns and version `0` without creating a row.
- PUT accepts `{ preferences, version }`. Version `0` creates the first row at version `1`; existing rows use an atomic version-checked update and return the incremented version. A competing create or stale update returns `409 conflict`.
- The server resolves the current administrator from the session and verifies the administrator still exists for every request. Client administrator IDs and arbitrary preference keys are rejected. JSON writes reject cross-origin browser requests. Responses are no-store.
- Validation limits saved views to 100, names to 80 characters, validates query keys/enums, rejects duplicate view IDs and columns, and requires the default view to reference a saved view.
- The UI changes saved state only after server confirmation. Errors leave previous state intact; conflicts require reload. Pending writes disable overlapping preference edits. Responses from cancelled or previous-administrator requests are ignored.
- Browser-local preferences can be explicitly imported when no server row exists. Local data is not silently substituted when server loading fails and is never written by the new preference flow. Source browser data is retained after import; the server row takes precedence on subsequent loads.

Profile tags and duplicate review decisions are not covered by these tables. Tags remain local; duplicate review remains read-only. Shared tags and persisted review decisions require separate approved models and permissions.

## Metrics and Activity

Reusable exports live in `lib/customer-profile-metrics.ts`: `netCompletedRevenue`, `computeCustomerProfileMetrics`, `computeProfileSegment`, `computeProfileChurnRisk`.

Completed means current Order status `delivered` only. Pending, confirmed, processing, shipped and cancelled orders contribute zero. Net LTV is delivered Order.total less positive same-currency Payment.amount values whose current status is `refunded`, clamped to zero per order. Totals already include recorded discounts, tax and shipping. This is an operational net delivered-order value, not an accounting profit or captured-cash measure. Partial/off-platform refunds not accurately recorded in Payment cannot be inferred. Full-refunded delivered orders still count in frequency and the AOV denominator; their net monetary value is zero. All orders, including cancellations, remain visible in the history.

Currencies are calculated separately with no exchange conversion. Monetary amounts use existing stored order/payment numeric units; no new currency-unit conversion rule is invented. The active cart shows item count only because CartItem has no explicit currency and optional captured prices cannot establish a reliable monetary total.

Recency uses whole elapsed days since the latest delivered order's **creation** time, not a fabricated delivery date. Frequency is delivered count. Purchase cycle is the unrounded mean interval between creation dates. Churn requires at least three delivered orders and a positive cycle; otherwise it is `insufficient`. High is recency >150 days; medium is >90 days or >2x cycle; otherwise low. It is a heuristic, not a statistical probability.

Segments retain rule-based recency/frequency thresholds, evaluated in order: no purchases, new, inactive (>300 days), hibernating (>120 days), champion (>=5 orders, <=60 days), loyal (>=3, <=90 days), at risk (>2.5x positive cycle), potential. Monetary value is displayed, but does not determine the segment. The UI explains these rules rather than implying percentile RFM scoring.

The timeline and summary counts use at most the latest 300 customer-linked events, explicitly labeled as a sample, not all-time totals. All 21 current schema event names have EN/ES labels; unknown events use a translated inferred category or Other activity, never a raw event name. Categories filter within real session IDs; the visible session numbers remain stable across filters. Exact times include seconds and the administrator's selected timezone. Sessions may be truncated by the 300-event window.

Recognized product/variant IDs are batch-resolved to names/SKUs; customer-owned order references link to the order. Recognized product names and search queries are shown without exposing the entire properties payload. When a name is unavailable, a page reference is shown without URL query parameters. Events not linked to this customer are not merged from visitor identities.

## Translations and Validation

The complete `CustomerProfile` and `CustomerList` namespaces are stored in `messages/en.json` and `messages/es.json`. The existing request configuration and root NextIntlClientProvider supply them to customer pages; no module-local JSON catalogs or provider overrides are needed. The profile keys cover headers, statuses, KPI units/plurals, RFM explanations, categories, all events, notes/actions and every notes error code. The customer management event labels reuse the same translated event mapping in its central namespace.

Run:

```sh
npx tsx --test tests/customerProfile*.test.ts
npx tsc --noEmit --incremental false
```

Tests cover metric states/refunds/currencies/churn, event normalization/session identity/human references, EN/ES key parity and ICU messages, note payload validation/permissions, parameterized transactional writes, audit rollback, customer scoping, concurrency conflicts, soft deletion and cross-origin protection. Transaction tests use a fake database and do not query or write a real database. Live migration execution, real PostgreSQL integration and authenticated browser verification remain deployment checks.
