import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: carouselId } = await params;
    const body = await request.json();
    const slideIds: unknown = body?.slideIds;
    if (!Array.isArray(slideIds) || !slideIds.every((slideId) => typeof slideId === 'string')) {
      return NextResponse.json({ message: 'Invalid slide order.' }, { status: 400 });
    }

    const currentSlides = await prisma.carouselSlide.findMany({
      where: { carouselId },
      select: { id: true },
      orderBy: { position: 'asc' },
    });
    const requestedIds = slideIds as string[];
    const currentIds = new Set(currentSlides.map((slide) => slide.id));
    if (
      requestedIds.length !== currentSlides.length ||
      new Set(requestedIds).size !== requestedIds.length ||
      requestedIds.some((slideId) => !currentIds.has(slideId))
    ) {
      return NextResponse.json({ message: 'Slide order must contain every carousel slide exactly once.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < requestedIds.length; index += 1) {
        await tx.carouselSlide.update({
          where: { id: requestedIds[index] },
          data: { position: -(requestedIds.length + index + 1) },
        });
      }
      for (let index = 0; index < requestedIds.length; index += 1) {
        await tx.carouselSlide.update({
          where: { id: requestedIds[index] },
          data: { position: index },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering carousel slides:', error);
    return NextResponse.json({ message: 'Failed to reorder slides.' }, { status: 500 });
  }
}