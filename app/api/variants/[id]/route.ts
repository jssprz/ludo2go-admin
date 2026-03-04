import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { PriceType, PriceCurrency } from '@prisma/client';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const {
      sku,
      edition,
      language,
      status,
      condition,
      storeUrls,
      prices,
    } = body;

    // Validate required fields
    if (!sku) {
      return NextResponse.json(
        { message: 'SKU is required' },
        { status: 400 }
      );
    }

    // Check if variant exists
    const existingVariant = await prisma.productVariant.findUnique({
      where: { id },
    });

    if (!existingVariant) {
      return NextResponse.json(
        { message: 'Variant not found' },
        { status: 404 }
      );
    }

    // Update the variant
    const updatedVariant = await prisma.productVariant.update({
      where: { id },
      data: {
        sku,
        edition,
        language,
        status,
        condition,
      },
    });

    // Handle store URLs updates
    if (storeUrls && Array.isArray(storeUrls)) {
      for (const storeUrl of storeUrls) {
        const { storeId, fullUrl } = storeUrl;

        if (!storeId || !fullUrl) continue;

        // Extract path from full URL
        try {
          const store = await prisma.store.findUnique({
            where: { id: storeId },
          });

          if (!store) continue;

          const url = new URL(fullUrl);
          const urlPath = url.pathname + url.search;

          // Check if ItemPriceInStore exists for this variant and store
          const existingPrice = await prisma.itemPriceInStore.findFirst({
            where: {
              variantId: id,
              storeId: storeId,
            },
            orderBy: {
              observedAt: 'desc',
            },
          });

          if (existingPrice) {
            // Update the URL path
            await prisma.itemPriceInStore.update({
              where: { id: existingPrice.id },
              data: {
                urlPathInStore: urlPath,
              },
            });
          } else {
            // Create new entry
            await prisma.itemPriceInStore.create({
              data: {
                variantId: id,
                storeId: storeId,
                urlPathInStore: urlPath,
                observedPrice: 0,
                currency: 'CLP',
                observedAt: new Date(),
              },
            });
          }
        } catch (error) {
          console.error(`Error processing store URL for ${storeId}:`, error);
          // Continue with other store URLs
        }
      }
    }

    // Handle prices updates
    if (prices && Array.isArray(prices)) {
      // Get existing price IDs for this variant
      const existingPrices = await prisma.price.findMany({
        where: { variantId: id },
        select: { id: true },
      });
      const existingPriceIds = new Set(existingPrices.map((p) => p.id));

      // Collect the IDs from the incoming payload (excluding temp IDs)
      const incomingPriceIds = new Set(
        prices
          .filter((p: any) => !String(p.id).startsWith('temp-'))
          .map((p: any) => p.id)
      );

      // Delete prices that were removed by the user
      const idsToDelete = Array.from(existingPriceIds).filter(
        (existingId) => !incomingPriceIds.has(existingId)
      );
      if (idsToDelete.length > 0) {
        await prisma.price.deleteMany({
          where: { id: { in: idsToDelete }, variantId: id },
        });
      }

      // Upsert each price from the payload
      for (const price of prices) {
        const isNew = String(price.id).startsWith('temp-');
        const priceData = {
          variantId: id,
          amount: typeof price.amount === 'string' ? parseInt(price.amount, 10) : price.amount,
          currency: (price.currency ?? 'CLP') as PriceCurrency,
          type: (price.type ?? 'retail') as PriceType,
          active: price.active ?? true,
          taxIncluded: price.taxIncluded ?? null,
          priceBookId: price.priceBookId ?? null,
          channelId: price.channelId ?? null,
          region: price.region ?? null,
          startsAt: price.startsAt ? new Date(price.startsAt) : null,
          endsAt: price.endsAt ? new Date(price.endsAt) : null,
        };

        if (isNew) {
          await prisma.price.create({ data: priceData });
        } else {
          await prisma.price.update({
            where: { id: price.id },
            data: priceData,
          });
        }
      }
    }

    // Handle inventory updates
    if (body.inventory && typeof body.inventory === 'object') {
      const inventoryData = body.inventory as Record<string, { onHand: number; reserved: number }>;

      for (const [locationId, stock] of Object.entries(inventoryData)) {
        // Check if inventory record exists
        const existingInventory = await prisma.inventory.findUnique({
          where: {
            variantId_locationId: {
              variantId: id,
              locationId: locationId,
            },
          },
        });

        if (existingInventory) {
          // Update existing inventory
          await prisma.inventory.update({
            where: {
              variantId_locationId: {
                variantId: id,
                locationId: locationId,
              },
            },
            data: {
              onHand: stock.onHand,
              reserved: stock.reserved,
            },
          });
        } else {
          // Create new inventory record
          await prisma.inventory.create({
            data: {
              variantId: id,
              locationId: locationId,
              onHand: stock.onHand,
              reserved: stock.reserved,
            },
          });
        }
      }
    }

    return NextResponse.json({
      message: 'Variant updated successfully',
      variant: updatedVariant,
    });
  } catch (error: any) {
    console.error('Error updating variant:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
        externalPrices: {
          orderBy: { observedAt: 'desc' },
        },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { message: 'Variant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ variant });
  } catch (error: any) {
    console.error('Error fetching variant:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE variant
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const existingVariant = await prisma.productVariant.findUnique({
      where: { id },
    });

    if (!existingVariant) {
      return NextResponse.json(
        { message: 'Variant not found' },
        { status: 404 }
      );
    }

    await prisma.productVariant.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Variant deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting variant:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to delete variant' },
      { status: 500 }
    );
  }
}
