import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
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
    // Note: You'll need to create a VariantPrice table in your Prisma schema
    // or adjust this based on your actual schema structure
    if (prices && Array.isArray(prices)) {
      // For now, we'll store prices as JSON or you can create a separate table
      // This depends on your database schema design
      
      // Option 1: If you have a VariantPrice model in Prisma
      // First, delete existing prices and create new ones
      // await prisma.variantPrice.deleteMany({
      //   where: { variantId: id },
      // });
      
      // for (const price of prices) {
      //   if (!price.id.startsWith('temp-')) {
      //     // It's an existing price, update it
      //     await prisma.variantPrice.update({
      //       where: { id: price.id },
      //       data: {
      //         amount: price.amount,
      //         currency: price.currency,
      //         type: price.type,
      //         isActive: price.isActive,
      //         startDate: price.startDate ? new Date(price.startDate) : null,
      //         endDate: price.endDate ? new Date(price.endDate) : null,
      //       },
      //     });
      //   } else {
      //     // It's a new price, create it
      //     await prisma.variantPrice.create({
      //       data: {
      //         variantId: id,
      //         amount: price.amount,
      //         currency: price.currency,
      //         type: price.type,
      //         isActive: price.isActive,
      //         startDate: price.startDate ? new Date(price.startDate) : null,
      //         endDate: price.endDate ? new Date(price.endDate) : null,
      //       },
      //     });
      //   }
      // }

      // Option 2: Store as JSON in the variant (if you have a prices field)
      // await prisma.productVariant.update({
      //   where: { id },
      //   data: {
      //     prices: JSON.stringify(prices),
      //   },
      // });
      
      console.log('Prices to be saved:', prices);
      // TODO: Implement price saving based on your schema
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
