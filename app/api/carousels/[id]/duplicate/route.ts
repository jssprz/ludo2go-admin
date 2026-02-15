import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { Prisma } from '@prisma/client';
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

    const { id } = await context.params;

    // Get the original carousel
    const original = await prisma.carousel.findUnique({
      where: { id },
      include: {
        slides: {
          include: {
            variants: true,
          },
        },
      },
    });

    if (!original) {
      return NextResponse.json(
        { message: 'Carousel not found' },
        { status: 404 }
      );
    }

    // Generate new unique key
    let newKey = `${original.key}-copy`;
    let counter = 1;
    while (await prisma.carousel.findUnique({ where: { key: newKey } })) {
      newKey = `${original.key}-copy-${counter}`;
      counter++;
    }

    // Create new carousel with slides and variants
    const newCarousel = await prisma.carousel.create({
      data: {
        key: newKey,
        placement: original.placement,
        title: original.title ? `${original.title} (Copy)` : null,
        isActive: false, // Start as inactive
        startAt: original.startAt,
        endAt: original.endAt,
        slides: {
          create: original.slides.map((slide) => ({
            position: slide.position,
            isActive: slide.isActive,
            name: slide.name,
            startAt: slide.startAt,
            endAt: slide.endAt,
            variants: {
              create: slide.variants.map((variant) => ({
                name: variant.name,
                isActive: variant.isActive,
                weight: variant.weight,
                payload: variant.payload === null ? Prisma.JsonNull : variant.payload,
                ctaText: variant.ctaText,
                ctaUrl: variant.ctaUrl,
                ctaType: variant.ctaType,
                ctaTarget: variant.ctaTarget,
                startAt: variant.startAt,
                endAt: variant.endAt,
              })),
            },
          })),
        },
      },
      include: {
        _count: {
          select: {
            slides: true,
          },
        },
      },
    });

    return NextResponse.json(newCarousel);
  } catch (error: any) {
    console.error('Error duplicating carousel:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
