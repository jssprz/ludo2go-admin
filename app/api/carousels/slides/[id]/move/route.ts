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

    const { id: slideId } = await context.params;
    const body = await request.json();
    const { direction } = body; // 'up' or 'down'

    if (!direction || !['up', 'down'].includes(direction)) {
      return NextResponse.json(
        { message: 'Invalid direction. Must be "up" or "down"' },
        { status: 400 }
      );
    }

    // Get the slide with all slides from same carousel
    const slide = await prisma.carouselSlide.findUnique({
      where: { id: slideId },
      include: {
        carousel: {
          include: {
            slides: {
              orderBy: {
                position: 'asc',
              },
            },
          },
        },
      },
    });

    if (!slide) {
      return NextResponse.json(
        { message: 'Slide not found' },
        { status: 404 }
      );
    }

    const slides = slide.carousel.slides;
    const currentIndex = slides.findIndex((s) => s.id === slideId);

    if (currentIndex === -1) {
      return NextResponse.json(
        { message: 'Slide not found in carousel' },
        { status: 404 }
      );
    }

    // Check if move is possible
    if (direction === 'up' && currentIndex === 0) {
      return NextResponse.json(
        { message: 'Slide is already at the top' },
        { status: 400 }
      );
    }

    if (direction === 'down' && currentIndex === slides.length - 1) {
      return NextResponse.json(
        { message: 'Slide is already at the bottom' },
        { status: 400 }
      );
    }

    // Swap positions
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentSlide = slides[currentIndex];
    const targetSlide = slides[targetIndex];

    await prisma.$transaction([
      prisma.carouselSlide.update({
        where: { id: currentSlide.id },
        data: { position: targetSlide.position },
      }),
      prisma.carouselSlide.update({
        where: { id: targetSlide.id },
        data: { position: currentSlide.position },
      }),
    ]);

    return NextResponse.json({ message: 'Slide moved successfully' });
  } catch (error: any) {
    console.error('Error moving slide:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
