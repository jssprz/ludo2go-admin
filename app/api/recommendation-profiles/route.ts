import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET — list all game/expansion products with their recommendation profiles
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() || '';

    const where: any = {
      kind: { in: ['game', 'expansion'] },
    };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        kind: true,
        status: true,
        recommendationProfile: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(products);
  } catch (error: any) {
    console.error('Error fetching recommendation profiles:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT — upsert a recommendation profile for a product
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, ...profileData } = body;

    if (!productId) {
      return NextResponse.json(
        { message: 'productId is required' },
        { status: 400 }
      );
    }

    // Remove fields that shouldn't be sent to Prisma
    delete profileData.product;
    delete profileData.createdAt;
    delete profileData.updatedAt;
    delete profileData.productId;

    const profile = await prisma.gameRecommendationProfile.upsert({
      where: { productId },
      create: {
        productId,
        ...profileData,
      },
      update: profileData,
    });

    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('Error saving recommendation profile:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
