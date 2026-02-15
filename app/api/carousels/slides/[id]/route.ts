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

    const slide = await prisma.carouselSlide.findUnique({
      where: { id },
      include: {
        carousel: true,
        variants: {
          orderBy: {
            createdAt: 'asc',
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

    return NextResponse.json(slide);
  } catch (error: any) {
    console.error('Error fetching slide:', error);
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
      startAt,
      endAt,
    } = body;

    // Check if slide exists
    const existing = await prisma.carouselSlide.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Slide not found' },
        { status: 404 }
      );
    }

    const slide = await prisma.carouselSlide.update({
      where: { id },
      data: {
        name,
        isActive: isActive ?? true,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
      },
    });

    return NextResponse.json(slide);
  } catch (error: any) {
    console.error('Error updating slide:', error);
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

    // Check if slide exists
    const existing = await prisma.carouselSlide.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Slide not found' },
        { status: 404 }
      );
    }

    // Partial update
    const slide = await prisma.carouselSlide.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(slide);
  } catch (error: any) {
    console.error('Error updating slide:', error);
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

    // Get slide with carousel info
    const slide = await prisma.carouselSlide.findUnique({
      where: { id },
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

    // Delete the slide (cascade will handle variants)
    await prisma.carouselSlide.delete({
      where: { id },
    });

    // Reorder remaining slides
    const remainingSlides = slide.carousel.slides.filter((s) => s.id !== id);
    await Promise.all(
      remainingSlides.map((s, index) =>
        prisma.carouselSlide.update({
          where: { id: s.id },
          data: { position: index },
        })
      )
    );

    return NextResponse.json({ message: 'Slide deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting slide:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
