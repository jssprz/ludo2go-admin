import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { auth } from '@/lib/auth';
import { ProductVariant } from '@prisma/client';

export const runtime = 'nodejs';
export const maxDuration = 30;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PackagingType = ProductVariant['packageType'];

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function toNumber(value: string): number | null {
  const normalized = value.replace(',', '.').trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[:\s]+$/g, '').trim();
}

function mapPackageType(raw: string | null): PackagingType | null {
  if (!raw) return null;

  const value = raw.toLowerCase();
  if (value.includes('caja') || value.includes('box')) return 'box';
  if (value.includes('bolsa') || value.includes('bag')) return 'bag';
  if (value.includes('tubo') || value.includes('tube')) return 'tube';
  if (value.includes('sobre') || value.includes('envelope')) return 'envelope';
  if (value.includes('sin empaque') || value.includes('ninguno') || value.includes('none')) return null;
  return 'other';
}

function parseDimensionsToMm(raw: string): { widthMm: number; heightMm: number; depthMm: number } | null {
  const match = raw
    .replace(/\s+/g, ' ')
    .match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i);

  if (!match) return null;

  const a = toNumber(match[1]);
  const b = toNumber(match[2]);
  const c = toNumber(match[3]);
  if (a == null || b == null || c == null) return null;

  const unit = match[4].toLowerCase();
  const factor = unit === 'm' ? 1000 : unit === 'cm' ? 10 : 1;

  return {
    widthMm: Math.round(a * factor),
    heightMm: Math.round(b * factor),
    depthMm: Math.round(c * factor)
  };
}

function parseWeightToGrams(raw: string): number | null {
  const match = raw
    .replace(/\s+/g, ' ')
    .match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo(?:gramos?)?|g|gr|gramos?)\b/i);

  if (!match) return null;

  const value = toNumber(match[1]);
  if (value == null) return null;

  const unit = match[2].toLowerCase();
  const grams = unit.startsWith('k') ? value * 1000 : value;
  return Math.round(grams);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await context.params;

    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url) {
      return NextResponse.json({ ok: false, message: 'URL is required' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ ok: false, message: 'Invalid URL' }, { status: 400 });
    }

    if (!parsedUrl.hostname.toLowerCase().includes('gatoarcano.cl')) {
      return NextResponse.json(
        { ok: false, message: 'URL must belong to GatoArcano (gatoarcano.cl)' },
        { status: 400 }
      );
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CL,es;q=0.9,en;q=0.5'
      },
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, message: `HTTP ${response.status} fetching product page` },
        { status: 502 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let dimensionsText: string | null = null;
    let weightText: string | null = null;
    let packagingText: string | null = null;

    $('.woocommerce-product-attributes-item').each((_, element) => {
      const label = normalizeLabel($(element).find('.woocommerce-product-attributes-item__label').text());
      const value = $(element).find('.woocommerce-product-attributes-item__value').text().trim();
      if (!value) return;

      if (!dimensionsText && (label.includes('dimension') || label.includes('dimensiones'))) {
        dimensionsText = value;
      }

      if (!weightText && (label.includes('peso') || label.includes('weight'))) {
        weightText = value;
      }

      if (
        !packagingText &&
        (label.includes('empaque') ||
          label.includes('packaging') ||
          label.includes('embalaje') ||
          label.includes('presentacion'))
      ) {
        packagingText = value;
      }
    });

    // Fallback: scan page text if attribute row labels are absent.
    const pageText = $('body').text();
    if (!dimensionsText) {
      const fallbackDim = pageText.match(/\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?\s*(mm|cm|m)\b/i);
      dimensionsText = fallbackDim?.[0] ?? null;
    }

    if (!weightText) {
      const fallbackWeight = pageText.match(/\d+(?:[.,]\d+)?\s*(kg|kilo(?:gramos?)?|g|gr|gramos?)\b/i);
      weightText = fallbackWeight?.[0] ?? null;
    }

    const dimensions = dimensionsText ? parseDimensionsToMm(dimensionsText) : null;
    const weightGrams = weightText ? parseWeightToGrams(weightText) : null;
    const packageType = mapPackageType(packagingText);

    return NextResponse.json({
      ok: true,
      result: {
        weightGrams,
        widthMm: dimensions?.widthMm ?? null,
        heightMm: dimensions?.heightMm ?? null,
        depthMm: dimensions?.depthMm ?? null,
        packageType
      },
      debug: {
        dimensionsText,
        weightText,
        packagingText
      }
    });
  } catch (error: any) {
    console.error('Error scraping physical attributes:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Failed to scrape physical attributes' },
      { status: 500 }
    );
  }
}
