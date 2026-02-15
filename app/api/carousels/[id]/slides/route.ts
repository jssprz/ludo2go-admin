import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id: carouselId } = await context.params;
    const body = await request.json();
    const {
      name,
      isActive,
      startAt,
      endAt,
    } = body;

    // Check if carousel exists
    const carousel = await prisma.carousel.findUnique({
      where: { id: carouselId },
      include: {
        slides: {
          orderBy: {
            position: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!carousel) {
      return NextResponse.json(
        { message: 'Carousel not found' },
        { status: 404 }
      );
    }

    // Calculate next position
    const nextPosition = carousel.slides.length > 0 
      ? carousel.slides[0].position + 1 
      : 0;

    const slide = await prisma.carouselSlide.create({
      data: {
        carouselId,
        position: nextPosition,
        name,
        isActive: isActive ?? true,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
      },
    });

    return NextResponse.json(slide);
  } catch (error: any) {
    console.error('Error creating slide:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
