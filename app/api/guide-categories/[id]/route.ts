import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/guide-categories/[id] - Get a single guide category
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const category = await prisma.guideCategory.findUnique({
      where: { id },
      include: {
        guides: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
          take: 10,
        },
        _count: {
          select: { guides: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Guide category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error fetching guide category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guide category' },
      { status: 500 }
    );
  }
}

// PUT /api/guide-categories/[id] - Update a guide category
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists (excluding current category)
    const existing = await prisma.guideCategory.findFirst({
      where: {
        slug,
        id: { not: id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Slug already exists' },
        { status: 400 }
      );
    }

    const category = await prisma.guideCategory.update({
      where: { id },
      data: {
        name,
        slug,
        description,
      },
      include: {
        _count: {
          select: { guides: true },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating guide category:', error);
    return NextResponse.json(
      { error: 'Failed to update guide category' },
      { status: 500 }
    );
  }
}

// DELETE /api/guide-categories/[id] - Delete a guide category
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if category has guides
    const category = await prisma.guideCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { guides: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Guide category not found' }, { status: 404 });
    }

    if (category._count.guides > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with existing guides' },
        { status: 400 }
      );
    }

    await prisma.guideCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting guide category:', error);
    return NextResponse.json(
      { error: 'Failed to delete guide category' },
      { status: 500 }
    );
  }
}