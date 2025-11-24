import { NextResponse } from 'next/server';
import { scrapeAndInsertExternalPrice } from '@/lib/scraping/external-price';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { message: 'Missing variant id' },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const url: string | undefined = body?.url;

  if (!url) {
    return NextResponse.json(
      { message: 'Missing url in body' },
      { status: 400 },
    );
  }

  try {
    const result = await scrapeAndInsertExternalPrice(id, url);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Scrape failed' },
      { status: 500 },
    );
  }
}