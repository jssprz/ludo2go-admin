import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

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

export async function GET(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const definition = await prisma.boardGamePrizeDefinition.findUnique({
      where: { id },
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

    if (!definition) {
      return NextResponse.json({ error: 'Prize definition not found' }, { status: 404 });
    }

    return NextResponse.json(definition);
  } catch (error) {
    console.error('Error fetching board game prize definition:', error);
    return NextResponse.json({ error: 'Failed to fetch prize definition' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
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

    const definition = await prisma.boardGamePrizeDefinition.update({
      where: { id },
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

    return NextResponse.json(definition);
  } catch (error) {
    console.error('Error updating board game prize definition:', error);

    const message = getMessage(error);
    if (message.includes('BoardGamePrizeDefinition_name_organizationId_key')) {
      return NextResponse.json(
        { error: 'A prize definition with this name already exists for this organization' },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to update prize definition' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const definition = await prisma.boardGamePrizeDefinition.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            prizes: true,
          },
        },
      },
    });

    if (!definition) {
      return NextResponse.json({ error: 'Prize definition not found' }, { status: 404 });
    }

    if (definition._count.prizes > 0) {
      return NextResponse.json(
        { error: 'Cannot delete definition with linked prizes' },
        { status: 400 }
      );
    }

    await prisma.boardGamePrizeDefinition.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting board game prize definition:', error);
    return NextResponse.json({ error: 'Failed to delete prize definition' }, { status: 500 });
  }
}
