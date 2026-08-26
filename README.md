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

The `/external-trending` page scrapes best-selling products from competitor stores and displays them as store cards.

Configured sources:

- **Demente Games** — https://dementegames.cl/10-juegos-de-mesa?order=product.sales.desc
- **Magicsur** — https://www.magicsur.cl/15-juegos-de-mesa-magicsur-chile?order=product.sales.desc
- **Updown** — https://www.updown.cl/categoria-producto/juegos-de-mesa/?orderby=popularity&paged=1
- **Antartica** — https://www.antartica.cl/juegos-y-accesorios/entretencion/juegos.html?product_list_order=bestseller&product_list_dir=desc

## Deployment

The project is deployed on Vercel. The build command runs Prisma client generation before the Next.js build:

```bash
prisma generate && next build
```
