import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';
import { google } from 'googleapis';
import type { content_v2_1 } from 'googleapis';

// ── Helpers ──────────────────────────────────────────────────────────

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

function getMerchantId(): string {
  const id = process.env.GOOGLE_MERCHANT_ID;
  if (!id) throw new Error('GOOGLE_MERCHANT_ID env var is not set');
  return id;
}

function getStorefrontBaseUrl(): string {
  return process.env.STOREFRONT_BASE_URL || 'https://jobys.cl';
}

/** Convert minor-unit integer (e.g. 12990) → "129.90" */
function minorToDecimal(amount: number, currency: string): string {
  // CLP has 0 decimals; USD/EUR have 2
  if (currency === 'CLP') return String(amount);
  return (amount / 100).toFixed(2);
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

    const merchantId = getMerchantId();
    const authClient = getAuthClient();
    const baseUrl = getStorefrontBaseUrl();

    const content = google.content({
      version: 'v2.1',
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
      },
    });

    const results: {
      synced: string[];
      errors: { offerId: string; error: string }[];
    } = { synced: [], errors: [] };

    // Build batch entries for custombatch (much faster than individual calls)
    const entries: content_v2_1.Schema$ProductsCustomBatchRequestEntry[] = [];
    let batchId = 0;

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
          .filter((ml) => ml.media.kind === 'image')
          .map((ml) => ml.media.url);
        const productImages = product.mediaLinks
          .filter((ml) => ml.media.kind === 'image')
          .map((ml) => ml.media.url);
        const allImages = variantImages.length > 0 ? variantImages : productImages;

        const imageLink = allImages[0] || '';
        const additionalImageLinks = allImages.slice(1);

        const offerId = variant.sku;
        const lang = mapLanguage(variant.language);
        const targetCountry = 'CL'; // Chile

        const title = variant.displayTitleShort || variant.displayTitleLong || product.name;
        const description =
          product.shortDescription ||
          product.description?.replace(/<[^>]*>/g, '').substring(0, 5000) ||
          product.name;

        const link = `${baseUrl}/products/${product.slug}`;

        const merchantProduct: content_v2_1.Schema$Product = {
          offerId,
          title,
          description,
          link,
          imageLink,
          additionalImageLinks:
            additionalImageLinks.length > 0 ? additionalImageLinks : undefined,
          contentLanguage: lang,
          targetCountry,
          channel: 'online',
          availability: mapAvailability(variant.status, totalStock),
          condition: mapCondition(variant.condition),
          brand: product.brand?.name || undefined,
          price: {
            value: minorToDecimal(retailPrice.amount, currency),
            currency,
          },
          itemGroupId: product.id, // groups all variants of same product
          productTypes: product.tags.length > 0 ? product.tags : undefined,
        };

        // Add availability date for scheduled / preorder variants
        if (variant.status === 'scheduled' && variant.activeAtScheduled) {
          merchantProduct.availabilityDate = variant.activeAtScheduled.toISOString();
        }

        // Add sale price if present and different from retail
        if (salePrice && salePrice.amount < retailPrice.amount) {
          merchantProduct.salePrice = {
            value: minorToDecimal(salePrice.amount, currency),
            currency,
          };
          // Add sale price effective date if available
          if (salePrice.startsAt && salePrice.endsAt) {
            merchantProduct.salePriceEffectiveDate =
              `${salePrice.startsAt.toISOString()}/${salePrice.endsAt.toISOString()}`;
          }
        }

        // Add weight if available
        if (variant.weightGrams) {
          merchantProduct.productWeight = {
            value: variant.weightGrams,
            unit: 'g',
          };
        }

        // Add dimensions if available
        if (variant.widthMm) {
          merchantProduct.productWidth = {
            value: variant.widthMm / 10,
            unit: 'cm',
          };
        }
        if (variant.heightMm) {
          merchantProduct.productHeight = {
            value: variant.heightMm / 10,
            unit: 'cm',
          };
        }
        if (variant.depthMm) {
          merchantProduct.productLength = {
            value: variant.depthMm / 10,
            unit: 'cm',
          };
        }

        // Add GTIN/EAN if available
        if (variant.eanUpc) {
          merchantProduct.gtin = variant.eanUpc;
        }

        // Game-specific details as custom attributes
        const customAttributes: content_v2_1.Schema$CustomAttribute[] = [];
        if (product.game) {
          if (product.game.minPlayers != null && product.game.maxPlayers != null) {
            customAttributes.push({
              name: 'number_of_players',
              value: `${product.game.minPlayers}-${product.game.maxPlayers}`,
            });
          }
          if (product.game.playtimeMin != null) {
            customAttributes.push({
              name: 'playing_time',
              value: `${product.game.playtimeMin}${product.game.playtimeMax ? '-' + product.game.playtimeMax : ''} min`,
            });
          }
          if (product.game.minAge != null) {
            customAttributes.push({
              name: 'suggested_age',
              value: `${product.game.minAge}+`,
            });
          }
        }
        if (customAttributes.length > 0) {
          merchantProduct.customAttributes = customAttributes;
        }

        entries.push({
          batchId: batchId++,
          merchantId: merchantId,
          method: 'insert', // insert acts as upsert — creates or updates
          product: merchantProduct,
        });
      }
    }

    const totalVariantsInDb = products.reduce((s, p) => s + p.variants.length, 0);

    if (entries.length === 0) {
      return NextResponse.json({
        message: 'No eligible products with variants and prices to sync.',
        synced: 0,
        errors: results.errors,
        productsFound: products.length,
        variantsFound: totalVariantsInDb,
        skippedNoPrice: results.errors.length,
      });
    }

    // Send in batches of 1000 (API limit per custombatch call)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const response = await content.products.custombatch({
        requestBody: { entries: batch },
      });

      if (response.data.entries) {
        for (const entry of response.data.entries) {
          const offerId =
            batch.find((b) => b.batchId === entry.batchId)?.product?.offerId ??
            `batch-${entry.batchId}`;

          if (entry.errors && entry.errors.errors && entry.errors.errors.length > 0) {
            results.errors.push({
              offerId,
              error: entry.errors.errors.map((e) => e.message).join('; '),
            });
          } else {
            results.synced.push(offerId);
          }
        }
      }
    }

    return NextResponse.json({
      message: `Sync complete. ${results.synced.length} product(s) synced, ${results.errors.length} error(s).`,
      synced: results.synced.length,
      errors: results.errors,
      total: entries.length,
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
