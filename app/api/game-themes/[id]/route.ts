import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

type GameThemePayload = {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  title?: unknown;
  subtitle?: unknown;
  emotional?: unknown;
  urgency?: unknown;
  benefits?: unknown;
  icon?: unknown;
  order?: unknown;
  isActive?: unknown;
  gameIds?: unknown;
  expansionIds?: unknown;
};

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

async function validateCatalogRelations(gameIds: string[], expansionIds: string[]) {
  if (gameIds.length > 0) {
    const gamesCount = await prisma.gameDetails.count({
      where: { productId: { in: gameIds } },
    });

    if (gamesCount !== gameIds.length) {
      throw new Error('Some selected games do not exist');
    }
  }

  if (expansionIds.length > 0) {
    const expansionsCount = await prisma.gameExpansionDetails.count({
      where: { productId: { in: expansionIds } },
    });

    if (expansionsCount !== expansionIds.length) {
      throw new Error('Some selected expansions do not exist');
    }
  }
}

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
          select: { games: true, expansions: true },
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
    const body = (await request.json()) as GameThemePayload;
    const name = toOptionalString(body.name);
    const slug = toOptionalString(body.slug);

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const hasGameIds = Object.prototype.hasOwnProperty.call(body, 'gameIds');
    const hasExpansionIds = Object.prototype.hasOwnProperty.call(body, 'expansionIds');
    const gameIds = toStringArray(body.gameIds);
    const expansionIds = toStringArray(body.expansionIds);

    if (hasGameIds || hasExpansionIds) {
      await validateCatalogRelations(gameIds, expansionIds);
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
        description: toOptionalString(body.description),
        title: toOptionalString(body.title),
        subtitle: toOptionalString(body.subtitle),
        emotional: toOptionalString(body.emotional),
        urgency: toOptionalString(body.urgency),
        benefits: toStringArray(body.benefits),
        icon: toOptionalString(body.icon),
        order: toOptionalNumber(body.order) ?? 0,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        ...(hasGameIds
          ? {
              games: {
                set: gameIds.map((productId) => ({ productId })),
              },
            }
          : {}),
        ...(hasExpansionIds
          ? {
              expansions: {
                set: expansionIds.map((productId) => ({ productId })),
              },
            }
          : {}),
      },
    });

    return NextResponse.json(theme);
  } catch (error: any) {
    console.error('Error updating game theme:', error);

    if (error?.message === 'Some selected games do not exist' || error?.message === 'Some selected expansions do not exist') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
          select: { games: true, expansions: true },
        },
      },
    });

    if (!theme) {
      return NextResponse.json({ error: 'Game theme not found' }, { status: 404 });
    }

    if (theme._count.games > 0 || theme._count.expansions > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete theme with associated games or expansions. Please remove links first or reassign them.',
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
