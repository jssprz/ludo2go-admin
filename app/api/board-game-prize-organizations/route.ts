import { NextResponse } from 'next/server';
import { prisma } from '@jssprz/ludo2go-database';
import { auth } from '@/lib/auth';

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

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const organizations = await prisma.boardGamePrizeOrganization.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            prizeDefinitions: true,
          },
        },
      },
    });

    return NextResponse.json(organizations);
  } catch (error) {
    console.error('Error fetching board game prize organizations:', error);
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as OrganizationPayload;
    const name = toOptionalString(body.name);

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const organization = await prisma.boardGamePrizeOrganization.create({
      data: {
        name,
        country: toOptionalString(body.country),
        websiteUrl: toOptionalString(body.websiteUrl),
        description: toOptionalString(body.description),
      },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    console.error('Error creating board game prize organization:', error);

    const message = getMessage(error);
    if (message.includes('BoardGamePrizeOrganization_name_key')) {
      return NextResponse.json({ error: 'An organization with this name already exists' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
  }
}
