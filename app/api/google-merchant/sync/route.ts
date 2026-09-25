import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { google } from 'googleapis';
import type { merchantapi_products_v1 } from 'googleapis';

// ── Helpers ──────────────────────────────────────────────────────────

// Content API for Shopping (content_v2_1) was sunset on 2026-08-18.
// This route now targets Merchant API v1 — see
// https://developers.google.com/merchant/api/guides/compatibility

function getAuthClient() {
  const credentials = process.env.GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON;
  if (!credentials) {
    throw new Error('GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON env var is not set');
  }

  const parsed = JSON.parse(credentials);
  return new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ['https://www.googleapis.com/auth/content'],
  });
}

function getMerchantAccountName(): string {
  const id = process.env.GOOGLE_MERCHANT_ID;
  if (!id) throw new Error('GOOGLE_MERCHANT_ID env var is not set');
  return `accounts/${id}`;
}

// A primary API data source must be created once in Merchant Center
// (Data sources → Add data source → API) before products can be inserted.
function getDataSourceName(accountName: string): string {
  const id = process.env.GOOGLE_MERCHANT_DATASOURCE_ID;
  if (!id) throw new Error('GOOGLE_MERCHANT_DATASOURCE_ID env var is not set');
  return `${accountName}/dataSources/${id}`;
}

function getStorefrontBaseUrl(): string {
  return process.env.STOREFRONT_BASE_URL || 'https://www.jobys.cl';
}

/** Run async tasks with a bounded concurrency (no bulk/custombatch endpoint in Merchant API v1). */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      await task(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

/** Convert our minor-unit integer amount to Merchant API's amountMicros string (1 unit = 1,000,000 micros). */
function toAmountMicros(amount: number, currency: string): string {
  // CLP has 0 decimals; USD/EUR have 2
  const decimalAmount = currency === 'CLP' ? amount : amount / 100;
  return String(Math.round(decimalAmount * 1_000_000));
}

function toPrice(amount: number, currency: string): merchantapi_products_v1.Schema$Price {
  return { amountMicros: toAmountMicros(amount, currency), currencyCode: currency };
}

/** Map our condition enum to Google's accepted values */
function mapCondition(condition: string): string {
  switch (condition) {
    case 'new':
      return 'new';
    case 'used':
      return 'used';
    case 'refurbished':
      return 'refurbished';
    default:
      return 'new';
  }
}

/** Map our product status + inventory to Google availability */
function mapAvailability(
  variantStatus: string,
  totalStock: number
): string {
  if (variantStatus === 'archived' || variantStatus === 'draft') return 'out of stock';
  if (variantStatus === 'scheduled') return 'preorder';
  if (variantStatus === 'paused') return 'out of stock';
  return totalStock > 0 ? 'in stock' : 'out of stock';
}

function mapLanguage(lang: string): string {
  switch (lang) {
    case 'es':
      return 'es';
    case 'en':
      return 'en';
    case 'fr':
      return 'fr';
    default:
      return 'es';
  }
}

// ── Main handler ─────────────────────────────────────────────────────

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountName = getMerchantAccountName();
    const dataSource = getDataSourceName(accountName);
    const authClient = getAuthClient();
    const baseUrl = getStorefrontBaseUrl();

    const merchantapi = google.merchantapi({
      version: 'products_v1',
      auth: authClient,
    });

    // Fetch all active products with their variants, prices, media, brand, and game details
    // Include scheduled products as "preorder" and paused variants as "out of stock"
    const products = await prisma.product.findMany({
      where: {
        status: { in: ['active', 'scheduled', 'paused'] },
      },
      include: {
        brand: true,
        mediaLinks: {
          include: { media: true },
          orderBy: { sort: 'asc' },
        },
        variants: {
          where: { status: { in: ['active', 'scheduled', 'paused'] } },
          include: {
            prices: {
              where: { active: true },
            },
            inventory: true,
            mediaLinks: {
              include: { media: true },
              orderBy: { sort: 'asc' },
            },
          },
        },
        game: true,
        expansion: true,
      },
    });

    const results: {
      synced: string[];
      errors: { offerId: string; error: string }[];
    } = { synced: [], errors: [] };

    // Merchant API v1 has no bulk/custombatch endpoint — build one productInput per variant
    // and insert them individually (see runWithConcurrency below).
    type PendingInsert = {
      offerId: string;
      productInput: merchantapi_products_v1.Schema$ProductInput;
    };
    const pendingInserts: PendingInsert[] = [];

    for (const product of products) {
      for (const variant of product.variants) {
        // Find the retail price (prefer retail, fall back to first active price)
        const retailPrice = variant.prices.find((p) => p.type === 'retail') ??
          variant.prices[0];
        const salePrice = variant.prices.find((p) => p.type === 'sale');

        if (!retailPrice) {
          results.errors.push({
            offerId: variant.sku,
            error: 'No active price found',
          });
          continue;
        }

        const currency = retailPrice.currency || 'CLP';

        // Total stock across all locations
        const totalStock = variant.inventory.reduce(
          (sum, inv) => sum + Math.max(0, inv.onHand - inv.reserved),
          0
        );

        // Images: variant-specific first, then product-level
        const variantImages = variant.mediaLinks
          .filter((ml) => ml.media.kind === 'image' && ml.role === 'primary')
          .map((ml) => ml.media.url);
        const productImages = product.mediaLinks
          .filter((ml) => ml.media.kind === 'image' && ml.role === 'primary')
          .map((ml) => ml.media.url);
        const allImages = variantImages.length > 0 ? variantImages : productImages;

        const imageLink = allImages[0] || '';
        const additionalImageLinks = allImages.slice(1);

        const offerId = variant.sku;
        const lang = mapLanguage(variant.language);
        const feedLabel = 'CL'; // Chile — also used as the target country grouping

        const title = variant.displayTitleShort || variant.displayTitleLong || product.name;
        const description =
          product.shortDescription ||
          product.description?.replace(/<[^>]*>/g, '').substring(0, 5000) ||
          product.name;

        const link = `${baseUrl}/products/${product.slug}`;

        const productAttributes: merchantapi_products_v1.Schema$ProductAttributes = {
          title,
          description,
          link,
          imageLink,
          additionalImageLinks:
            additionalImageLinks.length > 0 ? additionalImageLinks : undefined,
          availability: mapAvailability(variant.status, totalStock),
          condition: mapCondition(variant.condition),
          brand: product.brand?.name || undefined,
          price: toPrice(retailPrice.amount, currency),
          itemGroupId: product.id, // groups all variants of same product
          productTypes: product.tags.length > 0 ? product.tags : undefined,
        };

        // Add availability date for scheduled / preorder variants
        if (variant.status === 'scheduled' && variant.activeAtScheduled) {
          productAttributes.availabilityDate = variant.activeAtScheduled.toISOString();
        }

        // Add sale price if present and different from retail
        if (salePrice && salePrice.amount < retailPrice.amount) {
          productAttributes.salePrice = toPrice(salePrice.amount, currency);
          // Add sale price effective date if available
          if (salePrice.startsAt && salePrice.endsAt) {
            productAttributes.salePriceEffectiveDate = {
              startTime: salePrice.startsAt.toISOString(),
              endTime: salePrice.endsAt.toISOString(),
            };
          }
        }

        // Add weight if available
        if (variant.weightGrams) {
          productAttributes.productWeight = {
            value: variant.weightGrams,
            unit: 'g',
          };
        }

        // Add dimensions if available
        if (variant.widthMm) {
          productAttributes.productWidth = {
            value: variant.widthMm / 10,
            unit: 'cm',
          };
        }
        if (variant.heightMm) {
          productAttributes.productHeight = {
            value: variant.heightMm / 10,
            unit: 'cm',
          };
        }
        if (variant.depthMm) {
          productAttributes.productLength = {
            value: variant.depthMm / 10,
            unit: 'cm',
          };
        }

        // Add GTIN/EAN if available
        if (variant.eanUpc) {
          productAttributes.gtins = [variant.eanUpc];
        }

        // Game-specific details as custom attributes
        const customAttributes: merchantapi_products_v1.Schema$CustomAttribute[] = [];
        const details = product.game || product.expansion
        if (details) {
          if (details.minPlayers != null && details.maxPlayers != null) {
            customAttributes.push({
              name: 'number_of_players',
              value: `${details.minPlayers}-${details.maxPlayers}`,
            });
          }
          if (details.playtimeMin != null) {
            customAttributes.push({
              name: 'playing_time',
              value: `${details.playtimeMin}${details.playtimeMax ? '-' + details.playtimeMax : ''} min`,
            });
          }
          if (details.minAge != null) {
            customAttributes.push({
              name: 'suggested_age',
              value: `${details.minAge}+`,
            });
          }
        }

        pendingInserts.push({
          offerId,
          productInput: {
            offerId,
            contentLanguage: lang,
            feedLabel,
            productAttributes,
            customAttributes: customAttributes.length > 0 ? customAttributes : undefined,
          },
        });
      }
    }

    const totalVariantsInDb = products.reduce((s, p) => s + p.variants.length, 0);

    if (pendingInserts.length === 0) {
      return NextResponse.json({
        message: 'No eligible products with variants and prices to sync.',
        synced: 0,
        errors: results.errors,
        productsFound: products.length,
        variantsFound: totalVariantsInDb,
        skippedNoPrice: results.errors.length,
      });
    }

    // insert() acts as an upsert — creates or updates the product input.
    await runWithConcurrency(pendingInserts, 10, async ({ offerId, productInput }) => {
      try {
        await merchantapi.accounts.productInputs.insert({
          parent: accountName,
          dataSource,
          requestBody: productInput,
        });
        results.synced.push(offerId);
      } catch (err: any) {
        const message =
          err?.response?.data?.error?.message || err?.message || 'Unknown error';
        results.errors.push({ offerId, error: message });
      }
    });

    return NextResponse.json({
      message: `Sync complete. ${results.synced.length} product(s) synced, ${results.errors.length} error(s).`,
      synced: results.synced.length,
      errors: results.errors,
      total: pendingInserts.length,
      productsFound: products.length,
      variantsFound: totalVariantsInDb,
    });
  } catch (error: any) {
    console.error('Google Merchant sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync with Google Merchant Center' },
      { status: 500 }
    );
  }
}

