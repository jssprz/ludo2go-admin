# Ludo2Go Admin Dashboard

Admin dashboard for the Ludo2Go board game e-commerce platform, built with Next.js 15 App Router.

## Stack

- **Framework** — [Next.js 15](https://nextjs.org) (App Router, Turbopack)
- **Language** — [TypeScript](https://www.typescriptlang.org)
- **Auth** — [Auth.js v5](https://authjs.dev) (GitHub, Google, and Credentials providers)
- **Database** — [NeonDB](https://neon.tech) (Postgres) via [Prisma](https://www.prisma.io) + [Drizzle ORM](https://orm.drizzle.team)
- **Styling** — [Tailwind CSS](https://tailwindcss.com) + [Shadcn UI](https://ui.shadcn.com/)
- **i18n** — [next-intl](https://next-intl-docs.vercel.app/) (English / Spanish)
- **Rich Text** — [Tiptap](https://tiptap.dev)
- **Media** — [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- **Analytics** — [Vercel Analytics](https://vercel.com/analytics)
- **Deployment** — [Vercel](https://vercel.com)

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | NeonDB connection string |
| `AUTH_SECRET` | Random secret for Auth.js |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth app credentials |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth app credentials |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for media uploads |
| `SENSITIVE_BLOB_STORE_ID` | Private Vercel Blob store for delivery proof photos (accessed via Vercel OIDC; locally run `vercel env pull` to get `VERCEL_OIDC_TOKEN`) |
| `RESEND_API_KEY` | Resend API key for transactional and weekly report emails |
| `RESEND_FROM_EMAIL` | Verified sender address used for emails (optional). Order status emails add the display name `Jobys - Juegos de Mesa` when it is a bare address |
| `CRON_SECRET` | Bearer token used to authenticate scheduled Vercel cron requests |

### 3. Generate Prisma client

```bash
pnpm prisma:generate
```

### 4. Run the development server

```bash
pnpm dev
```

The app will be available at http://localhost:3000.

## Dashboard Sections

| Route | Description |
|---|---|
| `/products` | Product catalog management |
| `/variants` | Product variant management |
| `/inventory` | Stock levels per location |
| `/prices` | Pricing management |
| `/orders` | Order management |
| `/purchase-orders` | Purchase order management |
| `/customers` | Customer accounts |
| `/brands` | Brand management |
| `/bundles` | Product bundles |
| `/carousels` | Homepage carousel editor |
| `/guides` | Content guides with rich-text editor |
| `/media` | Media library (Vercel Blob) |
| `/promo-codes` | Promotional code management |
| `/stores` | Physical store locations |
| `/pickup-locations` | Click-and-collect points |
| `/suppliers` | Supplier management |
| `/opportunities` | Authenticated supplier stock versus linked external-store availability |
| `/game-categories` | Board game category taxonomy |
| `/game-mechanics` | Game mechanics taxonomy |
| `/game-themes` | Game theme taxonomy |
| `/game-complexities` | Complexity level taxonomy |
| `/board-game-awards` | Award management |
| `/recommendation-profiles` | Match-tool recommendation profiles |
| `/match-tool-analytics` | Match tool usage analytics |
| `/search-analytics` | Search query analytics |
| `/early-access` | Early access product management |
| `/presale` | Pre-sale management |
| `/external-trending` | Competitor best-seller tracker |
| `/admin-users` | Admin user management |

## External Trending

Supplier authentication, database persistence, and setup for Opportunities are documented in
[docs/opportunities.md](docs/opportunities.md). Apply the Opportunities model migration through the separate `@jssprz/ludo2go-database` package before deployment; Prisma generation alone does not create the tables. Configuration comes from `SupplierIntegration`, credentials remain server environment references, and supplier Notes/private Blob staging are no longer used. Vercel Blob remains required for media only. Supplier costs are never automatically updated.

The `/external-trending` page scrapes best-selling products from competitor stores and displays them as store cards.

Configured sources:

- **Demente Games** — https://dementegames.cl/10-juegos-de-mesa?order=product.sales.desc
- **Magicsur** — https://www.magicsur.cl/15-juegos-de-mesa-magicsur-chile?order=product.sales.desc
- **Updown** — https://www.updown.cl/categoria-producto/juegos-de-mesa/?orderby=popularity&paged=1
- **Antartica** — https://www.antartica.cl/juegos-y-accesorios/entretencion/juegos.html?product_list_order=bestseller&product_list_dir=desc

## Google Merchant Sync

The product sync uses `GOOGLE_MERCHANT_ID` and
`GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON` for the Merchant API account and credentials.
Each variant is inserted into a data source selected by its mapped content language:

- English (`en`): `GOOGLE_MERCHANT_DATASOURCE_EN_ID`, defaulting to `10791684150`
	(`jobys-catalog-en` in account `5745887023`). Override this ID for other accounts.
- Other languages: the existing `GOOGLE_MERCHANT_DATASOURCE_ID`.

All inputs retain `feedLabel: CL`. Each API data source must accept the input's
`contentLanguage` and `feedLabel` combination. Content language currently comes
from the variant language; it should reflect the submitted title, description,
and landing-page language, not just the physical game's language.
Deploy the changes and run the product sync to send English variants to the new source.

## Deployment

The project is deployed on Vercel. The build command runs Prisma client generation before the Next.js build:

```bash
prisma generate && next build
```

The weekly analytics report is sent to every admin user's email each Monday at 12:00 UTC (09:00 in Santiago during Chilean daylight time). It compares the most recent completed Monday-to-Monday week with the week before it.

The read-only cart activity report (`/api/cron/abandon-carts`, retained for schedule
compatibility) runs each Monday at 11:00 UTC. It never changes cart status fields.
Queries classify carts with stored `active` or `abandoned` status as active when
the cart or any remaining item was updated within the last 30 days; otherwise,
they are classified as abandoned. Exactly 30 days of inactivity counts as
abandoned. Ordered carts are excluded, and empty non-ordered carts are included
in report counts. Customer cart views, customer list filters, product relevance,
and inventory cart demand use the same query-time rule, independent of the cron.
Browsing alone does not count as cart activity; the storefront must update these
timestamps when cart contents change.
The job uses the same `CRON_SECRET` authentication as the other scheduled jobs
and takes effect after deployment to Vercel.
After each authenticated run, it sends a Spanish report to all admin users with
non-empty email addresses, including zero-count runs or a database failure.
The report includes run timestamps, the 30-day cutoff, and active, abandoned,
and total non-ordered cart counts (or an explicit failure when counts are unknown).
Active and abandoned counts are each broken down into customer and anonymous
visitor carts. Customer ownership uses the explicit cart customer first, otherwise
a visitor identified with exactly one customer through session events, matching
customer-list attribution. All remaining carts, including unidentified or
ambiguous owners, are counted in the anonymous category so breakdowns reconcile
with the totals. The counts come from one read-only database snapshot.
Delivery requires
`RESEND_API_KEY`; the sender uses `RESEND_FROM_EMAIL` when configured, otherwise
`Jobys Reports <reports@jobys.cl>`. Email failures return HTTP 500.
Each retry produces a fresh read-only snapshot of the counts.
