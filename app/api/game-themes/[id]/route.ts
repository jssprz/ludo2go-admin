import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

// GET /api/game-themes/[id] - Get a single game theme
export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const theme = await prisma.gameTheme.findUnique({
      where: { id },
      include: {
        _count: {
          select: { games: true },
        },
      },
    });

    if (!theme) {
      return NextResponse.json({ error: 'Game theme not found' }, { status: 404 });
    }

    return NextResponse.json(theme);
  } catch (error) {
    console.error('Error fetching game theme:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game theme' },
      { status: 500 }
    );
  }
}

// PUT /api/game-themes/[id] - Update a game theme
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

    // Check if slug already exists (but not for this theme)
    const existing = await prisma.gameTheme.findFirst({
      where: {
        slug,
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A game theme with this slug already exists' },
        { status: 400 }
      );
    }

    const theme = await prisma.gameTheme.update({
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

    return NextResponse.json(theme);
  } catch (error) {
    console.error('Error updating game theme:', error);
    return NextResponse.json(
      { error: 'Failed to update game theme' },
      { status: 500 }
    );
  }
}

// DELETE /api/game-themes/[id] - Delete a game theme
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const theme = await prisma.gameTheme.findUnique({
      where: { id },
      include: {
        _count: {
          select: { games: true },
        },
      },
    });

    if (!theme) {
      return NextResponse.json({ error: 'Game theme not found' }, { status: 404 });
    }

    if (theme._count.games > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete theme with associated games. Please remove games first or reassign them to another theme.',
        },
        { status: 400 }
      );
    }

    await prisma.gameTheme.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting game theme:', error);
    return NextResponse.json(
      { error: 'Failed to delete game theme' },
      { status: 500 }
    );
  }
}
