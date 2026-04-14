import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q) {
      return NextResponse.json([]);
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        OR: [
          { sku: { contains: q, mode: 'insensitive' } },
          { edition: { contains: q, mode: 'insensitive' } },
          { displayTitleShort: { contains: q, mode: 'insensitive' } },
          { displayTitleLong: { contains: q, mode: 'insensitive' } },
          { product: { name: { contains: q, mode: 'insensitive' } } },
          { product: { slug: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: {
        product: {
          select: { id: true, name: true },
        },
      },
      take: 20,
      orderBy: { product: { name: 'asc' } },
    });

    return NextResponse.json(variants);
  } catch (error: any) {
    console.error('Error searching variants:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
