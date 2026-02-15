import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const carousels = await prisma.carousel.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            slides: true,
          },
        },
      },
    });

    return NextResponse.json(carousels);
  } catch (error: any) {
    console.error('Error fetching carousels:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      key,
      placement,
      title,
      isActive,
      startAt,
      endAt,
    } = body;

    // Validate required fields
    if (!key || !placement) {
      return NextResponse.json(
        { message: 'Missing required fields: key, placement' },
        { status: 400 }
      );
    }

    // Check if key is unique
    const existing = await prisma.carousel.findUnique({
      where: { key },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'A carousel with this key already exists' },
        { status: 400 }
      );
    }

    const carousel = await prisma.carousel.create({
      data: {
        key,
        placement,
        title,
        isActive: isActive ?? true,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
      },
    });

    return NextResponse.json(carousel);
  } catch (error: any) {
    console.error('Error creating carousel:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
