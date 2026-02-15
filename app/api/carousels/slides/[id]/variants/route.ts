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
    const {
      name,
      isActive,
      weight,
      payload,
      ctaText,
      ctaUrl,
      ctaType,
      ctaTarget,
      startAt,
      endAt,
    } = body;

    // Check if slide exists
    const slide = await prisma.carouselSlide.findUnique({
      where: { id: slideId },
    });

    if (!slide) {
      return NextResponse.json(
        { message: 'Slide not found' },
        { status: 404 }
      );
    }

    // Validate payload is valid JSON
    if (payload && typeof payload !== 'object') {
      return NextResponse.json(
        { message: 'Payload must be a valid JSON object' },
        { status: 400 }
      );
    }

    const variant = await prisma.carouselSlideVariant.create({
      data: {
        slideId,
        name,
        isActive: isActive ?? true,
        weight: weight || 1,
        payload: payload || {},
        ctaText,
        ctaUrl,
        ctaType,
        ctaTarget,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
      },
    });

    return NextResponse.json(variant);
  } catch (error: any) {
    console.error('Error creating variant:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
