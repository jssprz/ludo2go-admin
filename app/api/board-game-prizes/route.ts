import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type PrizePayload = {
  prizeDefinitionId?: unknown;
  category?: unknown;
  year?: unknown;
  edition?: unknown;
  place?: unknown;
  description?: unknown;
  refLink?: unknown;
};

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prizes = await prisma.boardGamePrize.findMany({
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        prizeDefinition: {
          select: {
            id: true,
            name: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            games: true,
            expansions: true,
            events: true,
          },
        },
      },
    });

    return NextResponse.json(prizes);
  } catch (error) {
    console.error('Error fetching board game prizes:', error);
    return NextResponse.json({ error: 'Failed to fetch prizes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PrizePayload;
    const prizeDefinitionId = toOptionalString(body.prizeDefinitionId);

    if (!prizeDefinitionId) {
      return NextResponse.json({ error: 'prizeDefinitionId is required' }, { status: 400 });
    }

    const definitionExists = await prisma.boardGamePrizeDefinition.findUnique({
      where: { id: prizeDefinitionId },
      select: { id: true },
    });

    if (!definitionExists) {
      return NextResponse.json({ error: 'Prize definition not found' }, { status: 400 });
    }

    const prize = await prisma.boardGamePrize.create({
      data: {
        prizeDefinitionId,
        category: toOptionalString(body.category),
        year: toOptionalInt(body.year),
        edition: toOptionalString(body.edition),
        place: toOptionalString(body.place),
        description: toOptionalString(body.description),
        refLink: toOptionalString(body.refLink),
      },
      include: {
        prizeDefinition: {
          select: {
            id: true,
            name: true,
            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(prize, { status: 201 });
  } catch (error) {
    console.error('Error creating board game prize:', error);
    return NextResponse.json({ error: 'Failed to create prize' }, { status: 500 });
  }
}
