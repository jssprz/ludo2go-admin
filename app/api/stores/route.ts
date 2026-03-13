import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

// GET /api/stores - List all stores
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stores = await prisma.store.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { prices: true },
        },
      },
    });

    return NextResponse.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}

// POST /api/stores - Create a new store
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, logo, url, shipping, shippingCost, rating, reviews, paymentMethods } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    const store = await prisma.store.create({
      data: {
        name,
        logo: logo || '',
        url,
        shipping: shipping || 'paid',
        shippingCost: shippingCost != null ? Number(shippingCost) : null,
        rating: rating != null ? Number(rating) : 0,
        reviews: reviews != null ? Number(reviews) : 0,
        paymentMethods: paymentMethods || [],
      },
    });

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json(
      { error: 'Failed to create store' },
      { status: 500 }
    );
  }
}
