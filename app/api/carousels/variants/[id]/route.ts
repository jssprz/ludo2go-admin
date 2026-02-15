import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const variant = await prisma.carouselSlideVariant.findUnique({
      where: { id },
      include: {
        slide: {
          include: {
            carousel: true,
          },
        },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { message: 'Variant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(variant);
  } catch (error: any) {
    console.error('Error fetching variant:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
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

    // Check if variant exists
    const existing = await prisma.carouselSlideVariant.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Variant not found' },
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

    const variant = await prisma.carouselSlideVariant.update({
      where: { id },
      data: {
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
    console.error('Error updating variant:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Check if variant exists
    const existing = await prisma.carouselSlideVariant.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Variant not found' },
        { status: 404 }
      );
    }

    // Partial update
    const variant = await prisma.carouselSlideVariant.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(variant);
  } catch (error: any) {
    console.error('Error updating variant:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Get variant with slide info to check if it's the last one
    const variant = await prisma.carouselSlideVariant.findUnique({
      where: { id },
      include: {
        slide: {
          include: {
            variants: true,
          },
        },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { message: 'Variant not found' },
        { status: 404 }
      );
    }

    // Prevent deletion if it's the last variant
    if (variant.slide.variants.length <= 1) {
      return NextResponse.json(
        { message: 'Cannot delete the last variant of a slide' },
        { status: 400 }
      );
    }

    await prisma.carouselSlideVariant.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Variant deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting variant:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
