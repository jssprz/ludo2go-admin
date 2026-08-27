import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

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

// GET /api/game-mechanics - List all game mechanics
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const mechanics = await prisma.gameMechanic.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    return NextResponse.json(mechanics);
  } catch (error) {
    console.error('Error fetching game mechanics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game mechanics' },
      { status: 500 }
    );
  }
}

// POST /api/game-mechanics - Create a new game mechanic
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as GameMechanicPayload;
    const name = toOptionalString(body.name);
    const slug = toOptionalString(body.slug);
    const benefits = toStringArray(body.benefits);
    const gameIds = toStringArray(body.gameIds);
    const expansionIds = toStringArray(body.expansionIds);

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.gameMechanic.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A game mechanic with this slug already exists' },
        { status: 400 }
      );
    }

    await validateCatalogRelations(gameIds, expansionIds);

    const mechanic = await prisma.gameMechanic.create({
      data: {
        name,
        slug,
        description: toOptionalString(body.description),
        title: toOptionalString(body.title),
        subtitle: toOptionalString(body.subtitle),
        emotional: toOptionalString(body.emotional),
        urgency: toOptionalString(body.urgency),
        benefits,
        icon: toOptionalString(body.icon),
        bggId: toOptionalNumber(body.bggId),
        bggName: toOptionalString(body.bggName),
        order: toOptionalNumber(body.order) ?? 0,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        games: {
          connect: gameIds.map((productId) => ({ productId })),
        },
        expansions: {
          connect: expansionIds.map((productId) => ({ productId })),
        },
      },
    });

    return NextResponse.json(mechanic, { status: 201 });
  } catch (error: any) {
    console.error('Error creating game mechanic:', error);

    if (error?.message === 'Some selected games do not exist' || error?.message === 'Some selected expansions do not exist') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to create game mechanic' },
      { status: 500 }
    );
  }
}
