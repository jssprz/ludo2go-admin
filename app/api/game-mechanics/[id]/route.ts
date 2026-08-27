import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

type GameMechanicPayload = {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  title?: unknown;
  subtitle?: unknown;
  emotional?: unknown;
  urgency?: unknown;
  benefits?: unknown;
  icon?: unknown;
  bggId?: unknown;
  bggName?: unknown;
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
          select: { games: true, expansions: true },
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
    const body = (await request.json()) as GameMechanicPayload;
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
        description: toOptionalString(body.description),
        title: toOptionalString(body.title),
        subtitle: toOptionalString(body.subtitle),
        emotional: toOptionalString(body.emotional),
        urgency: toOptionalString(body.urgency),
        benefits: toStringArray(body.benefits),
        icon: toOptionalString(body.icon),
        bggId: toOptionalNumber(body.bggId),
        bggName: toOptionalString(body.bggName),
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

    return NextResponse.json(mechanic);
  } catch (error: any) {
    console.error('Error updating game mechanic:', error);

    if (error?.message === 'Some selected games do not exist' || error?.message === 'Some selected expansions do not exist') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
          select: { games: true, expansions: true },
        },
      },
    });

    if (!mechanic) {
      return NextResponse.json({ error: 'Game mechanic not found' }, { status: 404 });
    }

    if (mechanic._count.games > 0 || mechanic._count.expansions > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete mechanic with associated games or expansions. Please remove links first or reassign them.',
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
