import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

/**
 * SKU format: JBY-[SLUG]-[LANG][ED][FMT][BND][COND]-[SEQ]
 *
 * SLUG  = shortened product slug (first 8 chars, uppercased)
 * LANG  = ES | EN | FR
 * ED    = CL | US | EU | 2E | 3E | … (edition/region code)
 * FMT   = STD | DLX | TRV  (format)
 * BND   = (empty) | BND | B2 | B3 … (bundle indicator)
 * COND  = NEW | USED | RFB (condition)
 * SEQ   = 001, 002 … (collision-avoidance sequence)
 */

function shortenSlug(slug: string, maxLen = 8): string {
  // Remove common filler words and take the first maxLen chars
  const cleaned = slug
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
    .replace(/-/g, '');
  return cleaned.substring(0, maxLen);
}

function mapLanguage(lang: string): string {
  switch (lang) {
    case 'es': return 'ES';
    case 'en': return 'EN';
    case 'fr': return 'FR';
    default: return lang.toUpperCase().substring(0, 2);
  }
}

function mapEdition(edition: string | null | undefined): string {
  if (!edition) return '';
  const lower = edition.toLowerCase().trim();
  // Match common patterns
  if (/^2(nd|da|a)?\s*(ed|edici[oó]n|edition)?$/i.test(lower)) return '2E';
  if (/^3(rd|ra|a)?\s*(ed|edici[oó]n|edition)?$/i.test(lower)) return '3E';
  if (/^4(th|ta|a)?\s*(ed|edici[oó]n|edition)?$/i.test(lower)) return '4E';
  if (/^5(th|ta|a)?\s*(ed|edici[oó]n|edition)?$/i.test(lower)) return '5E';
  // Region/market
  if (/chile|chilena/i.test(lower)) return 'CL';
  if (/usa?|americana|american/i.test(lower)) return 'US';
  if (/euro|europea|european/i.test(lower)) return 'EU';
  if (/interna/i.test(lower)) return 'INT';
  // If short enough, use as-is (uppercased, max 3 chars)
  const code = lower.replace(/[^a-z0-9]/g, '').toUpperCase();
  return code.substring(0, 3);
}

function mapFormat(format: string | null | undefined): string {
  if (!format) return 'STD';
  const lower = format.toLowerCase().trim();
  if (/deluxe|dlx/i.test(lower)) return 'DLX';
  if (/travel|trv|viaje/i.test(lower)) return 'TRV';
  if (/mini/i.test(lower)) return 'MNI';
  if (/collector|coleccion/i.test(lower)) return 'COL';
  return 'STD';
}

function mapBundle(bundle: string | null | undefined): string {
  if (!bundle) return '';
  const lower = bundle.toLowerCase().trim();
  if (/^b(\d+)$/i.test(lower)) return lower.toUpperCase();
  if (/bundle|bnd/i.test(lower)) return 'BND';
  return '';
}

function mapCondition(condition: string): string {
  switch (condition) {
    case 'new': return 'NEW';
    case 'used': return 'USED';
    case 'refurbished': return 'RFB';
    default: return 'NEW';
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, language, edition, format, bundle, condition } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    // Get product slug
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Build the SKU segments
    const slugPart = shortenSlug(product.slug);
    const langPart = mapLanguage(language || 'es');
    const edPart = mapEdition(edition);
    const fmtPart = mapFormat(format);
    const bndPart = mapBundle(bundle);
    const condPart = mapCondition(condition || 'new');

    // Combine the middle segment (no separators between sub-parts)
    const middleParts = [langPart, edPart, fmtPart, bndPart, condPart].filter(Boolean);
    const middle = middleParts.join('');

    // Build the base SKU (without sequence)
    const basePrefix = `JBY-${slugPart}-${middle}-`;

    // Find existing SKUs with this prefix to determine sequence number
    const existingVariants = await prisma.productVariant.findMany({
      where: {
        sku: { startsWith: basePrefix },
      },
      select: { sku: true },
      orderBy: { sku: 'desc' },
    });

    // Determine the next sequence number
    let nextSeq = 1;
    if (existingVariants.length > 0) {
      for (const v of existingVariants) {
        const suffix = v.sku.replace(basePrefix, '');
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num >= nextSeq) {
          nextSeq = num + 1;
        }
      }
    }

    const seqStr = String(nextSeq).padStart(3, '0');
    const sku = `${basePrefix}${seqStr}`;

    return NextResponse.json({
      sku,
      parts: {
        prefix: 'JBY',
        slug: slugPart,
        language: langPart,
        edition: edPart,
        format: fmtPart,
        bundle: bndPart,
        condition: condPart,
        sequence: seqStr,
      },
    });
  } catch (error: any) {
    console.error('Error generating SKU:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate SKU' },
      { status: 500 }
    );
  }
}
