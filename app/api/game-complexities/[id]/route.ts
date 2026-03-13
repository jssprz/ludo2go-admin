import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/game-complexities/[id] - Get a single game complexity
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const complexity = await prisma.gameComplexity.findUnique({
      where: { id },
      include: {
        _count: {
          select: { games: true },
        },
      },
    });

    if (!complexity) {
      return NextResponse.json({ error: 'Game complexity not found' }, { status: 404 });
    }

    return NextResponse.json(complexity);
  } catch (error) {
    console.error('Error fetching game complexity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game complexity' },
      { status: 500 }
    );
  }
}

// PUT /api/game-complexities/[id] - Update a game complexity
export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, slug, description, icon, order, isActive } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists (but not for this record)
    const existing = await prisma.gameComplexity.findFirst({
      where: {
        slug,
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A game complexity with this slug already exists' },
        { status: 400 }
      );
    }

    const complexity = await prisma.gameComplexity.update({
      where: { id },
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        order: order ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json(complexity);
  } catch (error) {
    console.error('Error updating game complexity:', error);
    return NextResponse.json(
      { error: 'Failed to update game complexity' },
      { status: 500 }
    );
  }
}

// DELETE /api/game-complexities/[id] - Delete a game complexity
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Check if complexity has associated games
    const complexity = await prisma.gameComplexity.findUnique({
      where: { id },
      include: {
        _count: {
          select: { games: true },
        },
      },
    });

    if (!complexity) {
      return NextResponse.json({ error: 'Game complexity not found' }, { status: 404 });
    }

    if (complexity._count.games > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete complexity tier with associated games. Please remove games first or reassign them to another tier.',
        },
        { status: 400 }
      );
    }

    await prisma.gameComplexity.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting game complexity:', error);
    return NextResponse.json(
      { error: 'Failed to delete game complexity' },
      { status: 500 }
    );
  }
}
