import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type DefinitionPayload = {
  name?: unknown;
  organizationId?: unknown;
  description?: unknown;
};

function toOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const definitions = await prisma.boardGamePrizeDefinition.findMany({
      orderBy: { name: 'asc' },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            prizes: true,
          },
        },
      },
    });

    return NextResponse.json(definitions);
  } catch (error) {
    console.error('Error fetching board game prize definitions:', error);
    return NextResponse.json({ error: 'Failed to fetch prize definitions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as DefinitionPayload;
    const name = toOptionalString(body.name);
    const organizationId = toOptionalString(body.organizationId);

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (organizationId) {
      const organizationExists = await prisma.boardGamePrizeOrganization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });

      if (!organizationExists) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
      }
    }

    const definition = await prisma.boardGamePrizeDefinition.create({
      data: {
        name,
        organizationId,
        description: toOptionalString(body.description),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(definition, { status: 201 });
  } catch (error) {
    console.error('Error creating board game prize definition:', error);

    const message = getMessage(error);
    if (message.includes('BoardGamePrizeDefinition_name_organizationId_key')) {
      return NextResponse.json(
        { error: 'A prize definition with this name already exists for this organization' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to create prize definition' }, { status: 500 });
  }
}
