# Oportunities

The dashboard at `/opportunities` scans authenticated supplier catalogs and the external-store links already attached to ERP variants. A result is an opportunity only when the supplier explicitly has stock, the supplier mapping has been reviewed, and **every linked external store explicitly reports out of stock** for the expected variant. Missing links, identity mismatches, failed requests, preorder status, ambiguous stock, and unavailable prices are not out-of-stock evidence. Observations expire after one hour; rescan to refresh them.

## Deployment

Opportunities uses the models supplied by `@jssprz/ludo2go-database` 0.3.0: `SupplierIntegration`, `SupplierCatalogRun`, `SupplierCatalogProduct`, `SupplierProductObservation`, `ExternalStockObservation`, and `SupplierProductMappingReview`. **Schema migrations belong to that separate package.** Apply its reviewed migration through that package's deployment workflow before deploying this application, then run `npm run prisma:generate`. Generating the client alone does not create tables. This application does not modify installed schemas or automatically migrate a live database.

Missing tables or columns produce `database_migration_required`; database connection/read failures produce `database_unavailable` supplier statuses. Missing, disabled, invalid, and unsupported integrations have separate setup statuses. No Opportunities Blob token or private Blob store is required. `@vercel/blob` and `BLOB_READ_WRITE_TOKEN` remain in use for media only.

Each supplier's configuration lives exclusively in its `SupplierIntegration` row. Supplier Notes are never read as configuration. Runtime credentials are read through `SecretProvider` from server environment variables, not stored in the database JSON or returned to the client. References must match `SUPPLIER_[A-Z0-9_]+`; never use `NEXT_PUBLIC_` secrets. Configuration JSON accepts only `verification` and `catalog`, rejecting extra top-level fields.

Example credential variable names (values belong only in the Vercel dashboard):

- `SUPPLIER_ASMODEE_USERNAME`, `SUPPLIER_ASMODEE_PASSWORD`
- `SUPPLIER_DEVIR_USERNAME`, `SUPPLIER_DEVIR_PASSWORD`
- `SUPPLIER_LANAE_SESSION`: JSON containing browser-captured `cookies`
- `SUPPLIER_LANAE_BROWSER`: a private remote Chromium CDP endpoint, needed only for browser rendering

Deploy with a Vercel plan supporting the API route's 300-second maximum. Requests use bounded pagination, per-request timeouts, and four concurrent external checks. External checks stop after 200 links or their time budget, retain unchecked links as unknown, and flag `external_checks_incomplete`. Large catalogs should use a background worker before increasing these limits. There is no automatic scheduled scan.

## Integration Configuration

Provision the row using the database package's controlled tooling, not supplier Notes. There is no integration-settings editor in this dashboard. Set these columns:

| Column | Devir example / rule |
|---|---|
| `supplierId` | Existing active supplier ID |
| `adapterKey` | `devir`; app accepts only `asmodee`, `devir`, `lanae` |
| `baseUrl` | `https://btb.devir.cl` |
| `authMethod` | `form`; alternatives are `asmodee_api`, `browser_session` |
| `usernameSecretRef` / `passwordSecretRef` | `SUPPLIER_DEVIR_USERNAME` / `SUPPLIER_DEVIR_PASSWORD` |
| `sessionSecretRef` / `browserSecretRef` | Environment variable names only, when applicable |
| `browserRendering` | `false`, unless a verified remote rendering workflow is needed |
| `configVersion` | Positive integer; increment whenever behavior/configuration changes |
| `taxTreatment` | Explicit `unconfirmed`, `vat_included`, or `excluding_vat` |
| `taxVerifiedAt` | Set only after checking actual account tax evidence |
| `integrationVerifiedAt` | Operator verification metadata, not proof that this app has authenticated |
| `isEnabled` | Keep `false` until account-specific configuration has been verified |

This illustrative `config` JSON **must not be enabled without replacing and verifying its selectors, identity, catalog paths, terminal-page evidence, and expected count in the real account**:

```json
{
  "verification": {
    "path": "/REPLACE_WITH_ACCOUNT_PRICED_PRODUCT/",
    "accountSelector": ".REPLACE_WITH_AUTHENTICATED_ACCOUNT_MARKER",
    "account": {
      "path": "/REPLACE_WITH_ACCOUNT_PAGE/",
      "identitySelector": ".REPLACE_WITH_ACCOUNT_IDENTITY",
      "expectedIdentity": "REPLACE_WITH_EXACT_ACCOUNT_IDENTITY"
    },
    "priceSelector": ".REPLACE_WITH_ACCOUNT_PURCHASE_PRICE",
    "priceEvidence": "account_purchase_price",
    "verifiedAt": "2026-10-18T00:00:00Z"
  },
  "catalog": {
    "paths": ["/REPLACE_WITH_CATEGORY/"],
    "productSelector": "li.product",
    "nextSelector": "a.next.page-numbers",
    "terminalSelector": ".REPLACE_WITH_EXPLICIT_LAST_PAGE_MARKER",
    "priceSelector": ".REPLACE_WITH_ACCOUNT_PURCHASE_PRICE",
    "inStockSelector": ".instock",
    "outOfStockSelector": ".outofstock",
    "expectedMinimum": 1,
    "maxPages": 50
  }
}
```

Use an actual known catalog minimum, not `1`. `verifiedAt` records when the account-price evidence was manually checked, not the time the configuration was written. An absent next link is accepted only when the configured terminal marker is present. Site changes that remove either marker reject the run. Supplier HTML IDs come from `data-product-id` or `data-product_id`; SKUs from `data-product-sku`, `data-product_sku`, or `.sku`. Missing stable IDs reject a run; do not substitute product names for IDs. Category names are merged when identical products recur across configured category pages.

For JSON account endpoints, use `verification.account.identityPath` instead of `identitySelector`, with the exact expected account ID. For JSON purchase-price evidence set `verification.structuredPricePath` to a numeric account price field. Account identity is checked independently of the price; a public numeric price does not establish authentication.

## Supplier Behavior And Verification Status

**Asmodee:** previous public JavaScript inspection identified `POST https://b2b-back.asmodee.cl/api/login` with `{email,password,is_employee:0}`, a `plain_text_token` response, and bearer authorization with `X-Logged-As-Employee: 0`. Use `adapterKey: "asmodee"`, `baseUrl: "https://b2b.asmodee.cl"`, and `authMethod: "asmodee_api"`. Only those two exact origins are permitted. Credentials and tokens remain in memory. Account identity and an account-specific purchase price must both verify. Public catalog prices are never used as a substitute. This DB migration did not verify a live authenticated integration.

Authenticated catalog requests have **not** been inspected with this account. Asmodee scans remain disabled until `catalog.structured` is configured from actual authenticated requests. It requires dot-path keys `itemsPath`, `nextPath`, `totalPath`, `id`, `name`, `sku`, `barcode`, `url`, `categories`, `availability`, `purchasePrice`, `packQuantity`, `edition`, `language`, `expansion`; exact scalar `inStockValue` and `outOfStockValue`; and `paginationVerifiedAt`. `catalog.paths` must contain the verified structured request URLs. The next field must contain a next URL or explicit `null`/`false`, and the authoritative integer total must reconcile with collected unique IDs. Inspect the real response before configuring field names; they are deliberately not guessed. An API requiring non-URL pagination needs a verified adapter extension rather than fabricated completion.

**Devir:** previous public inspection identified WordPress/WooCommerce and the form at `/wp-login.php` with `log` and `pwd`. The adapter fetches the form, carries hidden fields/CSRF values forward, submits runtime credentials, and retains cookies. Configure authenticated category pages and account-price selectors after logging in. Cheerio parses their HTML and follows pagination, merging category duplicates only when identity, stock, and price agree. CAPTCHA or interactive account verification requires `authMethod: "browser_session"` and a captured session instead of credential-only login. Authenticated catalog behavior remains unverified here.

**LANAE:** previous public inspection identified Shopify customer authentication via `/customer_authentication/redirect` and redirection to its account service. An email code or other interactive challenge cannot be automated from secrets alone. Use `adapterKey: "lanae"`, `baseUrl: "https://lanae.cl"`, `authMethod: "browser_session"`, and `sessionSecretRef`. First verify whether authenticated HTML has the wholesale discount. If it does not, configure the actual authenticated structured pricing request, or enable `browserRendering: true` with `browserSecretRef`. The rendering fallback connects to remote Chromium, creates an isolated context with only that supplier's cookies, renders the page, waits for its account price, and passes rendered HTML to Cheerio. A missing wholesale price fails explicitly; public Shopify prices are not a fallback. Rendered cards must expose stable supplier IDs. Browser fallback requires a trusted CDP provider and has not been tested against a live account here.

## Browser-Assisted Login

Run locally, outside Vercel:

```sh
npx playwright install chromium
npm run supplier:login -- lanae
```

Complete login and any email-code verification directly in the browser, open an account-priced product on the supplier domain, then press Enter in the terminal. The helper creates a timestamped file under the git-ignored `.supplier-sessions/` directory with mode `0600`; it never prints cookie values. Put its JSON contents into the supplier's session environment variable through Vercel's secure dashboard, redeploy, then delete the local session file. Treat the file as a password. Never paste it into chat, logs, issue trackers, or source control.

Sessions are isolated per scan and supplier. Expired sessions trigger one fresh authentication attempt; a second failure rejects the run. Browser session renewal may require repeating the interactive step. Captured sessions cannot recreate an expired email verification. Asmodee's verified API login should be used for its bearer-token flow; cookie-only capture is not a substitute for its API token.

## Review And Data Safety

Normalized products retain supplier ID, stable supplier product ID, SKU, barcode, URL, categories, explicit availability, CLP purchase price, collection timestamp, pack quantity, edition, language, and expansion state. Missing prices and unknown pack quantities stay `null`. Purchase prices are CLP major units in staging; they are not written into the ERP's minor-unit `CostPrice.amount` field.

Persisted tax treatment comes from the integration row, overriding adapter extraction defaults. There is no inferred legal/accounting rule: choose the actual account treatment explicitly and leave it `unconfirmed` when uncertain. Set `taxVerifiedAt` only after checking real account evidence. Pack quantities are never inferred from prices or silently converted to per-unit prices.

Matching uses reviewed supplier mappings first, then exact barcode, then exact SKU; exact normalized names only propose a mapping. Identifier matches also require review. The review dialog requires explicit edition, language, expansion, and pack-size acknowledgment. A changed supplier identity invalidates the review and appends an invalidation audit entry. Mapping confirmation appends an audit entry with observation, previous/new variant, identity and admin, and updates the current mapping in the same transaction. Existing external observations are **not deleted or rewritten**: checks predating the review are excluded, requiring a rescan. Unknown, expired or identity-unverified checks cannot qualify a result.

Reads, scan reservations/finalization, mapping reviews and approvals use parameterized Postgres transaction-scoped advisory locks per supplier. A fresh `running` attempt rejects another scan with HTTP 409. After five minutes a replacement scan marks abandoned attempts `failed` with `scan_lease_expired` and starts a new audited run. Superseded workers cannot finalize. Collection failures record sanitized errors; rejected catalog attempts record validation errors and counts without inserting invalid/duplicate observations. Valid staged supplier and retailer observations are append-only; historical runs remain stored while the API displays the latest attempt. A crashed process can leave `running` until the next scan recovers it. Persistence failures roll back their transaction; retry after restoring database access.

Approvals are latest-run-only, staged, error-free, under one hour old, and tied to unchanged integration configuration. Repeated approval preserves the original approver and timestamp. Starting a scan prevents concurrent approval or mapping review of the previous run. Configuration changes block old results even when previously approved; increment `configVersion` to start a new comparison baseline. No supplier network calls occur while a database transaction is open.

## Legacy Data

There is no automatic Blob or Notes fallback/import. Existing private snapshots remain untouched and are not required to deploy. Prefer configuring integration rows and collecting/reviewing a fresh baseline. If historical import is required, make it an explicit, separately reviewed offline migration using database-package tooling: validate each source record, preserve true observation/review timestamps and identities, reconcile admin/variant/store foreign keys, and keep unknowns unqualified. Never copy credential values, cookies, tokens, or raw session state into configuration JSON, audit evidence, reports, or logs. Retire the old private staging token only after deciding whether that history must be retained; keep media storage credentials separate.

The first run requires baseline review. Price changes over 30% or count changes over 25% are flagged and cannot produce opportunities until the staged run is approved. Missing prices and unverified taxes remain visible flags. Rejected or partial catalogs cannot be approved. Approval stores an audited baseline only; **it does not update supplier records, product records, cost prices, or purchase orders**. Supplier updates are intentionally out of scope until a separate reviewed apply workflow is requested.

External checks use only existing database store links, require expected ERP barcode/SKU evidence, pin connections to vetted public DNS addresses, reject cross-origin redirects, bound response sizes, and keep ambiguous data unknown. Some stores that omit identifiers will therefore require a later reviewed retailer-specific adapter rather than being classified optimistically.

## Checks

```sh
npx tsx --test tests/supplierCatalog.test.ts tests/supplierAdapters.test.ts tests/externalStock.test.ts
npx vitest run --config tests/vitest.opportunities.config.ts
npx tsc --noEmit --incremental false
```

Automated checks use fixture adapters and mocked Prisma/service/API dependencies, including run validation, immutable persistence, mapping audit failures, stale identity/configuration, locking guards and idempotent approvals. They do not replace a real-Postgres concurrency test or authenticated supplier acceptance testing. No supplier auth secrets were supplied and no live authentication, database migration, legacy import, or supplier-record update was performed.
