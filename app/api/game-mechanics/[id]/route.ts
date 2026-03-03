import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/game-mechanics/[id] - Get a single game mechanic
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const mechanic = await prisma.gameMechanic.findUnique({
      where: { id },
      include: {
        _count: {
          select: { games: true },
        },
      },
    });

    if (!mechanic) {
      return NextResponse.json({ error: 'Game mechanic not found' }, { status: 404 });
    }

    return NextResponse.json(mechanic);
  } catch (error) {
    console.error('Error fetching game mechanic:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game mechanic' },
      { status: 500 }
    );
  }
}

// PUT /api/game-mechanics/[id] - Update a game mechanic
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

    // Check if slug already exists (but not for this mechanic)
    const existing = await prisma.gameMechanic.findFirst({
      where: {
        slug,
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A game mechanic with this slug already exists' },
        { status: 400 }
      );
    }

    const mechanic = await prisma.gameMechanic.update({
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

    return NextResponse.json(mechanic);
  } catch (error) {
    console.error('Error updating game mechanic:', error);
    return NextResponse.json(
      { error: 'Failed to update game mechanic' },
      { status: 500 }
    );
  }
}

// DELETE /api/game-mechanics/[id] - Delete a game mechanic
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const mechanic = await prisma.gameMechanic.findUnique({
      where: { id },
      include: {
        _count: {
          select: { games: true },
        },
      },
    });

    if (!mechanic) {
      return NextResponse.json({ error: 'Game mechanic not found' }, { status: 404 });
    }

    if (mechanic._count.games > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete mechanic with associated games. Please remove games first or reassign them to another mechanic.',
        },
        { status: 400 }
      );
    }

    await prisma.gameMechanic.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting game mechanic:', error);
    return NextResponse.json(
      { error: 'Failed to delete game mechanic' },
      { status: 500 }
    );
  }
}
