import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

type RouteParams = {
  params: Promise<{ id: string }>;
};

type OrganizationPayload = {
  name?: unknown;
  country?: unknown;
  websiteUrl?: unknown;
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
    const organization = await prisma.boardGamePrizeOrganization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            prizeDefinitions: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error fetching board game prize organization:', error);
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as OrganizationPayload;
    const name = toOptionalString(body.name);

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const organization = await prisma.boardGamePrizeOrganization.update({
      where: { id },
      data: {
        name,
        country: toOptionalString(body.country),
        websiteUrl: toOptionalString(body.websiteUrl),
        description: toOptionalString(body.description),
      },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error updating board game prize organization:', error);

    const message = getMessage(error);
    if (message.includes('BoardGamePrizeOrganization_name_key')) {
      return NextResponse.json({ error: 'An organization with this name already exists' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const organization = await prisma.boardGamePrizeOrganization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            prizeDefinitions: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (organization._count.prizeDefinitions > 0) {
      return NextResponse.json(
        { error: 'Cannot delete organization with linked prize definitions' },
        { status: 400 }
      );
    }

    await prisma.boardGamePrizeOrganization.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting board game prize organization:', error);
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
  }
}
