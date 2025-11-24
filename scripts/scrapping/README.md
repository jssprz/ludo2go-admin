# Scraping scripts

This folder contains utilities used to scrape external e-commerce stores for product prices and to insert observed prices into the database.

## Purpose
- Extract current product prices from external merchant pages (WooCommerce, custom storefronts, etc.).
- Persist observed prices into the local database (`ItemPriceInStore`) for price comparison and historical tracking.

## Tech stack
- Node.js (server-side scripts)
- Playwright (browser automation for scraping)
- Prisma (DB client)
- PostgreSQL (database used by Prisma)
- Optional: sharp (image processing) if you add image handling in scraping flows

## Files
- `scrape-external-price.js` — CLI scraper that extracts price from a single product URL and insert the observed external price into DB
- `update-external-prices.js` — Batch scraper that reads store/variant rows from the DB and inserts fresh observed prices using Playwright and Prisma.

## Prerequisites
- Node.js 18+ (or compatible)
- npm/yarn
- Project dependencies installed:

  npm install
  npm install playwright @prisma/client
  npx playwright install

- A configured `.env` with the same environment vars your app uses (DATABASE_URL, etc.) so Prisma can connect.

## Usage

Scrape a single page and print the result:

  node scrape-external-price.js fallback-game-1-v1 https://gatoarcano.cl/product/wingspan-nesting-box/

Run the batch updater (reads DB and inserts observed prices):

  node update-external-prices.js

Notes:
- Playwright downloads browser binaries on first run (use `npx playwright install`).
- Scripts expect the DB to contain store entries and ItemPriceInStore rows (see Prisma models).

## How the scrapers work
1. They open a headless browser context with Playwright (custom user agent + locale).
2. Prefer JSON-LD (structured data) when present — this yields stable price extraction.
3. If JSON-LD is not available or doesn't contain an offer, the scripts use configurable CSS selector templates per hostname.
4. Extracted raw price text is normalized (thousand separators, decimals) to a numeric minor-unit value (CLP as default in examples).
5. `update-external-prices.js` persists a new observed price row in the DB for each successful scrape.

## Configuration & Templates
- `scrape-external-price.js` and `update-external-prices.js` include a mapping of hostnames → selector templates for site-specific scraping.
- Add or tune selectors for new stores by editing the `TEMPLATES` / `PRICE_SELECTORS` constants in the scripts.

## Best practices & tips
- Rate limiting: when scraping many pages, add delays and concurrency limits to avoid being blocked.
- Caching: avoid scrapping the same page too often; store `observedAt` timestamps and skip recent entries.
- Error handling: network errors and site layout changes are common — log failures and keep a retry policy.
- Respect robots.txt and site TOS: ensure scraping is allowed for your use case.

## Troubleshooting
- Playwright errors: run `npx playwright install` and ensure browsers are available.
- Database errors: confirm `DATABASE_URL` is set and reachable by Prisma.
- Price not found: inspect the page in a real browser, find the correct selector, and add it to the templates.

## Extending
- Add support for authentication (cookies/session) for stores that require login to see prices.
- Use distributed scraping (queue + workers) for large-scale scraping with backoff and retries.
- Add metrics and monitoring (sentry/Prometheus) for job success/failure rates.

## License
Project code follows the repository license.
