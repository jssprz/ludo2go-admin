import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
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
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json(
        { message: 'Store ID is required' },
        { status: 400 }
      );
    }

    // Find the variant and store
    const variant = await prisma.productVariant.findUnique({
      where: { id },
    });

    if (!variant) {
      return NextResponse.json(
        { message: 'Variant not found' },
        { status: 404 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      );
    }

    // Find the existing price entry
    const priceEntry = await prisma.itemPriceInStore.findFirst({
      where: {
        variantId: id,
        storeId: storeId,
      },
      orderBy: {
        observedAt: 'desc',
      },
    });

    if (!priceEntry || !priceEntry.urlPathInStore) {
      return NextResponse.json(
        { message: 'No URL configured for this store. Please set the URL first.' },
        { status: 400 }
      );
    }

    // TODO: Implement actual web scraping logic here
    // For now, we'll return a mock response
    // You would integrate with your scraping library/service here
    
    // Example: Import your scraping function
    // import { scrapeExternalPrice } from '@/lib/scraping/external-price';
    // const result = await scrapeExternalPrice(store.url, priceEntry.urlPathInStore);
    
    // Mock scraping result for now
    const mockPrice = Math.floor(Math.random() * 50000) + 10000; // Random price between 10000-60000
    const scrapedData = {
      price: mockPrice,
      currency: 'CLP',
      observedAt: new Date().toISOString(),
    };

    // Update the price in the database
    await prisma.itemPriceInStore.update({
      where: { id: priceEntry.id },
      data: {
        observedPrice: scrapedData.price,
        currency: scrapedData.currency as any, // Cast to handle enum type
        observedAt: new Date(scrapedData.observedAt),
      },
    });

    return NextResponse.json({
      message: 'Price scraped successfully',
      ...scrapedData,
    });
  } catch (error: any) {
    console.error('Error scraping price:', error);
    return NextResponse.json(
      { message: error.message || 'Failed to scrape price' },
      { status: 500 }
    );
  }
}
