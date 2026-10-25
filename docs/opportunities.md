# Oportunities

The dashboard at `/opportunities` scans authenticated supplier catalogs and the external-store links already attached to ERP variants. A result is an opportunity only when the supplier explicitly has stock, the supplier mapping has been reviewed, and **every linked external store explicitly reports out of stock** for the expected variant. Missing links, identity mismatches, failed requests, preorder status, ambiguous stock, and unavailable prices are not out-of-stock evidence. Observations expire after one hour; rescan to refresh them.

## Deployment

Opportunities uses the models supplied by `@jssprz/ludo2go-database` 0.3.0: `SupplierIntegration`, `SupplierCatalogRun`, `SupplierCatalogProduct`, `SupplierProductObservation`, `ExternalStockObservation`, and `SupplierProductMappingReview`. **Schema migrations belong to that separate package.** Apply its reviewed migration through that package's deployment workflow before deploying this application, then run `npm run prisma:generate`. Generating the client alone does not create tables. This application does not modify installed schemas or automatically migrate a live database.

Missing tables or columns produce `database_migration_required`; database connection/read failures produce `database_unavailable` supplier statuses. Missing, disabled, invalid, and unsupported integrations have separate setup statuses. No Opportunities Blob token or private Blob store is required. `@vercel/blob` and `BLOB_READ_WRITE_TOKEN` remain in use for media only.

Each supplier's configuration lives exclusively in its `SupplierIntegration` row. Supplier Notes are never read as configuration. Runtime credentials are read through `SecretProvider` from server environment variables, not stored in the database JSON or returned to the client. References must match `SUPPLIER_[A-Z0-9_]+`; never use `NEXT_PUBLIC_` secrets. Configuration JSON accepts only `verification` and `catalog`, rejecting extra top-level fields.

Example credential variable names (values belong only in the Vercel dashboard):

- `SUPPLIER_ASMODEE_USERNAME`, `SUPPLIER_ASMODEE_PASSWORD`
- `SUPPLIER_DEVIR_USERNAME`, `SUPPLIER_DEVIR_PASSWORD`
- Lanae needs no credentials or session: its catalog and prices are public
- `SUPPLIER_LANAE_BROWSER`: a private remote Chromium CDP endpoint, needed only for browser rendering

Deploy with a Vercel plan supporting the API route's 300-second maximum. Requests use bounded pagination, per-request timeouts, and four concurrent external checks. External checks stop after 200 links or their time budget, retain unchecked links as unknown, and flag `external_checks_incomplete`. Large catalogs should use a background worker before increasing these limits. There is no automatic scheduled scan.

## Integration Configuration

Open **Suppliers → supplier actions → Configure integration**, or **Edit → Integration**. Each Opportunities supplier also links directly to `/suppliers?integration=<supplierId>`. The integration editor is separate from the supplier business form and never changes contact details, notes, or payment terms.

New integrations are prefilled with the observed Devir configuration. Selecting Asmodee replaces the form with that adapter's observed endpoints, field paths, pagination and secret-reference names. Existing empty integrations can use **Advanced configuration → Load observed defaults**; custom secret-reference names are preserved. Generated configurations remain disabled; review them and confirm the Vercel variable names before explicitly enabling. Lanae still needs a browser session and account-specific catalog configuration.

Disabled drafts can be incomplete. Enabling requires the complete runtime configuration, supported origins/authentication combinations, the appropriate environment reference names, and structured catalog pagination for Asmodee. Advanced JSON accepts only the current `verification` and `catalog` schema, including strict nested keys. Never paste passwords, cookies, tokens, or secret values into JSON or reference fields. Secrets are provisioned separately in the server environment; the editor only reads and writes their `SUPPLIER_...` reference names.

Saving performs no supplier login or network verification. Verification timestamps are explicit operator metadata and are never assigned automatically. The editor increments `configVersion` for behavioral changes, uses the scan's supplier-scoped transaction lock, rejects stale edits with 409, and blocks saves during a live scan lease. After a conflict, reload and reapply your changes. Missing integration tables return 503 and require the separate database package migration.

The editor manages these columns:

| Column                                    | Devir example / rule                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `supplierId`                              | Existing active supplier ID                                               |
| `adapterKey`                              | `devir`; app accepts only `asmodee`, `devir`, `lanae`                     |
| `baseUrl`                                 | `https://btb.devir.cl`                                                    |
| `authMethod`                              | `form`; alternatives are `asmodee_api`, `browser_session`                 |
| `usernameSecretRef` / `passwordSecretRef` | `SUPPLIER_DEVIR_USERNAME` / `SUPPLIER_DEVIR_PASSWORD`                     |
| `sessionSecretRef` / `browserSecretRef`   | Environment variable names only, when applicable                          |
| `browserRendering`                        | `false`, unless a verified remote rendering workflow is needed            |
| `configVersion`                           | Automatically incremented for behavior/configuration changes              |
| `taxTreatment`                            | Explicit `unconfirmed`, `vat_included`, or `excluding_vat`                |
| `taxVerifiedAt`                           | Set only after checking actual account tax evidence                       |
| `integrationVerifiedAt`                   | Operator verification metadata, not proof that this app has authenticated |
| `isEnabled`                               | Keep `false` until account-specific configuration has been verified       |

The integration editor generates the JSON below from the authenticated provider pages inspected on 2026-10-23. Review it against the current account before enabling; the Devir product count is a conservative floor, not a promise that the catalog will remain unchanged:

```json
{
  "verification": {
    "path": "/producto/jdm-polilla-tramposa/",
    "accountSelector": "body.logged-in",
    "account": {
      "path": "/producto/jdm-polilla-tramposa/",
      "identitySelector": "a[href*=\"customer-logout\"]",
      "expectedIdentity": "Log out"
    },
    "priceSelector": ".summary .price ins .woocommerce-Price-amount bdi",
    "priceEvidence": "account_purchase_price",
    "verifiedAt": "2026-10-23T07:00:00Z"
  },
  "catalog": {
    "paths": ["/categoria-producto/devir/"],
    "productSelector": "li.product",
    "nextSelector": "a.next.page-numbers",
    "terminalSelector": ".woocommerce-pagination .page-numbers > li:last-child > .page-numbers.current",
    "priceSelector": ".price ins .woocommerce-Price-amount bdi",
    "inStockSelector": ".instock",
    "outOfStockSelector": ".outofstock",
    "expectedMinimum": 426,
    "maxPages": 60
  }
}
```

`verifiedAt` records the authenticated account-price observation. An absent next link is accepted only when the configured terminal marker is present. Site changes that remove either marker reject the run. Devir archive product IDs come from WordPress `post-{id}` classes; card categories come from `product_cat-*`; SKU/barcode are not present on the inspected cards and stay `null`. Missing stable IDs reject a run; product names are only mapping proposals. Category names are merged when identical products recur across configured category pages.

For JSON account endpoints, use `verification.account.identityPath` instead of `identitySelector`. Asmodee uses `expectedIdentity: "$authenticated"`, which requires a non-empty identity from its protected `/api/auth` response without storing a customer ID. For JSON purchase-price evidence set `verification.structuredPricePath` to a numeric account price field. Account identity is checked independently of the price; a public numeric price does not establish authentication.

## Supplier Behavior And Verification Status

**Asmodee:** authenticated inspection confirmed `POST https://b2b-back.asmodee.cl/api/login` with `{email,password,is_employee:0}`, a `plain_text_token` response, and bearer authorization with `X-Logged-As-Employee: 0`. The catalog endpoint is `/api/catalog-products` with `include=family,mainImage,publisher,family.restrictedCustomers`, `per_page=50`, `page`, and `sort=name`. The live response exposed `data`, `links.next`, `meta.total` (2,555 items, 52 pages), `id`, `sku`, `ean`, `name`, `status`, `units_per_box`, `family.name`, and `customerPrice.total`. The account purchase price is `customerPrice.total`, not `recommendedPrice.total`; this response also includes `amount_taxes`, but the integration deliberately leaves Asmodee tax treatment `unconfirmed`. URLs are derived from `/catalog/{id}`. The editor fills this structured mapping. Its `expectedIdentity: "$authenticated"` setting requires a non-empty account ID from the protected `/api/auth` endpoint without placing the account ID in the integration row. Authentication and these endpoint fields were observed in the user's live session; deployment Vercel credentials and database integration rows remain the operator's setup.

**Devir:** authenticated inspection confirmed WordPress/WooCommerce login at `/wp-login.php` with `log` and `pwd`. `/categoria-producto/devir/` returned 60 cards on each of seven pages and six on page eight (426 observed). The final-page marker is the current page span as the final pagination list item. Cards use `li.product`, `post-{id}`, `instock`/`outofstock`, `.price ins .woocommerce-Price-amount bdi`, and `product_cat-*` classes; the inspected category contains the B2B price and displays `IVA Incluido`. A product detail page confirmed SKU markup and JSON-LD, but the archive cards do not expose SKU/barcode; the list adapter retains those as `null` rather than making 426 detail requests. The integration editor fills this observed configuration. A CAPTCHA or new interactive challenge still requires `authMethod: "browser_session"`.

**LANAE:** the catalog is public, so the integration runs anonymously: no login, session secret or account verification is used (`sessionSecretRef` may stay empty; `authMethod` is ignored for this adapter and `verification.account`/`accountSelector` are optional, `priceEvidence: "public_price"` is accepted). The catalog is read from Lanae's public Shopify feed (`<catalog path>/products.json?limit=250&page=N`, e.g. `/collections/all`), one entry per variant with its price, `available` flag, SKU and barcode, so the HTML selectors are unused; a run with no prices is still rejected. The notes below and the Browser-Assisted Login section are legacy and no longer required. Previous public inspection identified Shopify customer authentication via `/customer_authentication/redirect` and redirection to its account service. An email code or other interactive challenge cannot be automated from secrets alone. Use `adapterKey: "lanae"`, `baseUrl: "https://lanae.cl"`, `authMethod: "browser_session"`, and `sessionSecretRef`. First verify whether authenticated HTML has the wholesale discount. If it does not, configure the actual authenticated structured pricing request, or enable `browserRendering: true` with `browserSecretRef`. The rendering fallback connects to remote Chromium, creates an isolated context with only that supplier's cookies, renders the page, waits for its account price, and passes rendered HTML to Cheerio. A missing wholesale price fails explicitly; public Shopify prices are not a fallback. Rendered cards must expose stable supplier IDs. Browser fallback requires a trusted CDP provider and has not been tested against a live account here.

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

Matching uses saved supplier mappings first, then barcode (EAN/UPC/GTIN, compared by digits with leading zeros ignored, so EAN-13 and UPC-A forms of the same code match), then exact SKU. Each identifier must resolve to exactly one catalog variant, and these matches are linked automatically with no manual review. Exact normalized names only propose a mapping and still need a manual link. Manual links append an audit entry with observation, previous/new variant, identity and admin. Unknown, expired or identity-unverified external checks cannot qualify a result.

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

## New products (not in our catalog)

The **New products** tab lists supplier products that are in stock and not linked to a catalog variant. Competitor stock is checked live, on demand, per product or for the current page (**Check competitors**); results are not persisted because `ExternalStockObservation` requires a catalog `variantId`, and they are lost on reload.

Only stores that already have at least one `ItemPriceInStore` link are searched, by EAN (falling back to an exact normalized name match when the supplier has no EAN) through `/search?q=` and `/?s=&post_type=product`. A store counts as carrying the product only when a result page's JSON-LD GTIN matches the EAN. A product is a new-product opportunity when at least one store carries it and every store that does reports it out of stock; any `in_stock` or unreadable (`unknown`) result disqualifies it. Stores where the product isn't found are ignored. Qualifying products also appear under **Opportunities** until the page is reloaded.
