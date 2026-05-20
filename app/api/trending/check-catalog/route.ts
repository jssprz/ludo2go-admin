import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, storeKey } = body;

    if (!url || !storeKey) {
      return NextResponse.json(
        { error: 'URL and store key are required' },
        { status: 400 }
      );
    }

    // Parse URL to get path and query
    let urlPath: string;
    try {
      const parsedUrl = new URL(url);
      urlPath = parsedUrl.pathname + parsedUrl.search;
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // Find store by key (e.g., 'dementegames', 'jugueterik', etc.)
    const store = await prisma.store.findFirst({
      where: {
        name: storeKey,
      },
    });

    if (!store) {
      // Store not in our database, so product can't be catalogued
      return NextResponse.json({ inCatalog: false, reason: 'store_not_found' });
    }

    // Check if any product variant has an ItemPriceInStore entry with this URL
    const itemPrice = await prisma.itemPriceInStore.findFirst({
      where: {
        storeId: store.id,
        urlPathInStore: urlPath,
      },
      select: {
        variant: {
          select: {
            id: true,
            sku: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (itemPrice) {
      return NextResponse.json({
        inCatalog: true,
        variantId: itemPrice.variant.id,
        variantSku: itemPrice.variant.sku,
        productName: itemPrice.variant.product.name,
      });
    }

    return NextResponse.json({
      inCatalog: false,
      reason: 'not_found',
    });
  } catch (error: any) {
    console.error('Error checking catalog:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
