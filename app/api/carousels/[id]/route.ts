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

    const carousel = await prisma.carousel.findUnique({
      where: { id },
      include: {
        slides: {
          orderBy: {
            position: 'asc',
          },
          include: {
            variants: true,
          },
        },
        _count: {
          select: {
            slides: true,
          },
        },
      },
    });

    if (!carousel) {
      return NextResponse.json(
        { message: 'Carousel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(carousel);
  } catch (error: any) {
    console.error('Error fetching carousel:', error);
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

    // Check if carousel exists
    const existing = await prisma.carousel.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Carousel not found' },
        { status: 404 }
      );
    }

    // Check if key is unique (if changed)
    if (key !== existing.key) {
      const keyExists = await prisma.carousel.findUnique({
        where: { key },
      });

      if (keyExists) {
        return NextResponse.json(
          { message: 'A carousel with this key already exists' },
          { status: 400 }
        );
      }
    }

    const carousel = await prisma.carousel.update({
      where: { id },
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
    console.error('Error updating carousel:', error);
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

    // Check if carousel exists
    const existing = await prisma.carousel.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Carousel not found' },
        { status: 404 }
      );
    }

    // Partial update
    const carousel = await prisma.carousel.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(carousel);
  } catch (error: any) {
    console.error('Error updating carousel:', error);
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

    // Check if carousel exists
    const existing = await prisma.carousel.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { message: 'Carousel not found' },
        { status: 404 }
      );
    }

    // Delete cascade will handle slides and variants
    await prisma.carousel.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Carousel deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting carousel:', error);
    return NextResponse.json(
      { message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
