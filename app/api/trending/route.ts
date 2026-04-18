import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { scrapeAllTrending } from '@/lib/scraping/external-trending';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // allow up to 30s for scraping

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const results = await scrapeAllTrending();
    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error scraping trending:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
