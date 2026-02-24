import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/game-categories/[id] - Get a single game category
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const category = await prisma.gameCategory.findUnique({
      where: { id },
      include: {
        media: true,
        _count: {
          select: { games: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Game category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error fetching game category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game category' },
      { status: 500 }
    );
  }
}

// PUT /api/game-categories/[id] - Update a game category
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description, icon, order, isActive, mediaId } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists (but not for this category)
    const existingCategory = await prisma.gameCategory.findFirst({
      where: {
        slug,
        NOT: { id },
      },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'A game category with this slug already exists' },
        { status: 400 }
      );
    }

    const category = await prisma.gameCategory.update({
      where: { id },
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        order: order ?? 0,
        isActive: isActive ?? true,
        mediaId: mediaId || null,
      },
      include: {
        media: true,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating game category:', error);
    return NextResponse.json(
      { error: 'Failed to update game category' },
      { status: 500 }
    );
  }
}

// DELETE /api/game-categories/[id] - Delete a game category
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if category has associated games
    const category = await prisma.gameCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { games: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Game category not found' }, { status: 404 });
    }

    if (category._count.games > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete category with associated games. Please remove games first or reassign them to another category.' 
        },
        { status: 400 }
      );
    }

    await prisma.gameCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting game category:', error);
    return NextResponse.json(
      { error: 'Failed to delete game category' },
      { status: 500 }
    );
  }
}
