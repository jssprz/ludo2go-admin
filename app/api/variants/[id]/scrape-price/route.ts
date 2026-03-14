import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { scrapeAndInsertExternalPrice } from '@/lib/scraping/external-price';

export const runtime = 'nodejs';
export const maxDuration = 30; // Allow up to 30s for fetch-based scraping

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
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
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { message: 'URL is required' },
        { status: 400 }
      );
    }

    const result = await scrapeAndInsertExternalPrice(id, url);

    return NextResponse.json({
      ok: true,
      result: {
        price: result.price,
        currency: result.currency,
        observedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error scraping price:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Failed to scrape price' },
      { status: 500 }
    );
  }
}
